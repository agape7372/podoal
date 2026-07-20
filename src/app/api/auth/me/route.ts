import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { buildClearAuthCookie, getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return Response.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    // select 좁히기(스켈레톤 감사) — 예전엔 전 컬럼(bcrypt 해시·providerId 포함)을
    // 끌어와 8필드만 쓰고 버렸다. 응답(profile) 계약은 그대로, 전송·직렬화만 준다.
    // 해시가 매 페이지 로드마다 메모리에 실리는 위생 문제도 함께 제거.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        provider: true,
        analyticsConsentAt: true,
        createdAt: true,
        dayResetHour: true,
      },
    });

    if (!user) {
      return Response.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      // additive(2026-07-10) — 계측 동의 기기 간 동기화 + OAuth 복귀 시 가입/로그인 판별용.
      analyticsConsentAt: user.analyticsConsentAt,
      createdAt: user.createdAt,
      // additive(C4-b) — "하루의 시작" 시각(0~6). 스트릭·히트맵·텀 판정 클라 즉답용.
      dayResetHour: user.dayResetHour,
    };

    return Response.json({ user: profile });
  } catch (error) {
    console.error("Get current user error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Clear the token cookie by setting Max-Age=0
    const response = Response.json({ message: "Logged out successfully." });
    response.headers.set(
      "Set-Cookie",
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
    );
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// 회원탈퇴(W1-D) — User를 참조하는 관계 대부분이 onDelete 미지정(Restrict)이라
// 단순 user.delete()는 FK로 막힌다(2026-07-06 schema 실측). 자식 → 부모 순서의
// 트랜잭션 순차 삭제로 처리한다. 스키마 무변경(마이그레이션 없음).
//
// 정책(카드 W1-D-API에서 확정):
// - 내가 심은 깜짝 선물(타인 보드 포함): 삭제 — 미공개분은 조용히 사라진다.
// - 메시지(송·수신)·친구관계(양방향)·리마인더·알림설정·타임캡슐: 삭제.
// - 내가 만든 릴레이: 통째 삭제(참가자 행은 cascade) — 동료의 연결 보드 자체는 남는다.
//   내가 참가만 한 릴레이: 내 참가자 행만 삭제.
// - 내 보드: 전부 삭제(스티커·보상·캡슐·심긴 선물은 cascade, 메시지 boardId는 SetNull).
//   선물 복사본은 ownerId=수령자(giftBoardCopy)라 남의 진행을 지우는 일은 없다.
//   단 내가 '선물한' 흔적(타인 보드의 giftedFromId=나)은 FK를 위해 null로 끊는다
//   (보드·진행은 그대로, '누구에게 받았는지' 표시만 사라짐 — 탈퇴자의 잔상 제거 겸).
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  // 커스텀 알 사진 고아 정리(additive) — 트랜잭션이 내 보드를 지우기 전에 URL을
  // 먼저 수집해둔다. 트랜잭션이 실패하면 이 목록은 버리고 blob은 건드리지 않는다.
  const boardsWithImage = await prisma.board.findMany({
    where: { ownerId: userId, customImageUrl: { not: null } },
    select: { customImageUrl: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.plantedGift.deleteMany({ where: { plantedById: userId } });
      await tx.message.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      });
      await tx.friendship.deleteMany({
        where: { OR: [{ requesterId: userId }, { receiverId: userId }] },
      });
      await tx.reminder.deleteMany({ where: { userId } });
      await tx.notificationSetting.deleteMany({ where: { userId } });
      await tx.timeCapsule.deleteMany({ where: { userId } });
      await tx.relayParticipant.deleteMany({ where: { userId } });
      await tx.relay.deleteMany({ where: { creatorId: userId } });
      // 타인 소유 보드 위 내 스티커 — 현행 쓰기 경로(owner/giftedTo만 채움, 복사본은
      // 수령자 소유)상 존재하지 않아야 하나, 남아 있으면 user.delete가 FK로 막힌다.
      // 방어적 정리(정상 데이터면 0행).
      await tx.sticker.deleteMany({
        where: { filledBy: userId, board: { NOT: { ownerId: userId } } },
      });
      // 타인 소유 보드에 남은 나의 참조(내가 선물한 복사본의 giftedFrom / 방어적 giftedTo).
      await tx.board.updateMany({
        where: { giftedFromId: userId, NOT: { ownerId: userId } },
        data: { giftedFromId: null },
      });
      await tx.board.updateMany({
        where: { giftedToId: userId, NOT: { ownerId: userId } },
        data: { giftedToId: null },
      });
      // 내 보드 삭제 전, 내 보드를 참조하는 타인의 릴레이 참가 행 연결 해제
      // (RelayParticipant.boardId는 내 참가 행에만 있는 게 정상이지만 방어적으로).
      await tx.relayParticipant.updateMany({
        where: { board: { ownerId: userId } },
        data: { boardId: null },
      });
      await tx.board.deleteMany({ where: { ownerId: userId } });
      // PushSubscription은 onDelete: Cascade — user 삭제와 함께 정리된다.
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return Response.json(
      { error: "탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  // 트랜잭션 성공 후에만 blob 삭제 — 실패는 무시(고아 잔존 수용, 탈퇴 자체는 성공).
  const imageUrls = boardsWithImage
    .map((b) => b.customImageUrl)
    .filter((url): url is string => url !== null);
  if (imageUrls.length > 0) {
    await del(imageUrls).catch(() => {});
  }

  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", buildClearAuthCookie());
  return response;
}
