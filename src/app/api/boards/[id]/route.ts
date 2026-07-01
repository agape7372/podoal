import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { checkRewardAuthorship } from '@/lib/rewardAccess';

// Board detail never renders email — and this board GET is now reachable by an
// accepted friend (read-only), so DON'T expose other users' email to them.
const userProfileSelect = {
  id: true,
  name: true,
  avatar: true,
};

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: { select: userProfileSelect },
      giftedTo: { select: userProfileSelect },
      giftedFrom: { select: userProfileSelect },
      stickers: {
        include: {
          filler: { select: userProfileSelect },
        },
        orderBy: { position: 'asc' },
      },
      rewards: {
        orderBy: { triggerAt: 'asc' },
      },
      // 포도동 연결 여부(inRelay) — 양 모드(그룹·순차) 공통으로 선물 차단에 쓰인다.
      // creatorId는 canManageRewards(보상 심기/편집 가능 여부) 판정용.
      relayParticipants: { select: { relay: { select: { mode: true, creatorId: true } } } },
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  // Owner and gift recipient can always view. An accepted friend of the owner
  // may also view (read-only) so "친구 포도판 보기" can open the board page
  // instead of bouncing home — the board page renders read-only when isOwner is
  // false (no fill, no owner actions). Filling is still owner-gated server-side.
  // Owner and gift recipient see the full board; an accepted friend gets a
  // read-only view with private reward content / gift message masked (below).
  const isViewerPrivileged = board.ownerId === userId || board.giftedToId === userId;
  if (!isViewerPrivileged) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, receiverId: board.ownerId },
          { requesterId: board.ownerId, receiverId: userId },
        ],
      },
    });
    if (!friendship) {
      // 같은 포도동(릴레이)에 속한 보드면 동료가 읽기전용으로 열람 허용 —
      // 이 board가 어떤 릴레이 참가자의 보드이고, 요청자도 그 릴레이 참가자일 때.
      // (보상 본문은 아래 canSeeBody에서 비-privileged로 계속 마스킹됨.)
      const coParticipant = await prisma.relayParticipant.findFirst({
        where: { boardId: id, relay: { participants: { some: { userId } } } },
        select: { id: true },
      });
      if (!coParticipant) {
        return authResponse('Forbidden', 403);
      }
    }
  }

  const filledCount = board.stickers.length;

  // Process rewards:
  // - title is always visible (for the locked preview)
  // - content/imageUrl masking은 '잠김(미도달)' 보상의 지연 공개 서스펜스용 —
  //   owner/gift recipient에겐 **unlocked(도달)부터** 공개한다. 도달 시점에
  //   팝업이 자동으로 내용을 보여주므로 unlocked-미공개 구간을 가려봐야
  //   서스펜스 이득은 없고, 칩 재탭이 reveal 왕복을 기다리는 동안 스켈레톤만
  //   보였다(보상 무한로딩 체감, 2026-06-13). 방문 친구는 공개 여부와 무관하게
  //   본문을 절대 받지 않는다(편지 본문·기프티콘 이미지 프라이버시).
  //   unlocked 판정은 unlockedAt 또는 현재 채움 수(구보드 백필 — reveal 라우트와
  //   동일 기준)로 한다.
  const rewards = board.rewards.map((reward) => {
    const unlocked = reward.unlockedAt !== null || filledCount >= reward.triggerAt;
    const canSeeBody = unlocked && isViewerPrivileged;
    return {
      id: reward.id,
      type: reward.type,
      title: reward.title,
      content: canSeeBody ? reward.content : '',
      imageUrl: canSeeBody ? reward.imageUrl : '',
      triggerAt: reward.triggerAt,
      unlockedAt: reward.unlockedAt ? reward.unlockedAt.toISOString() : null,
      revealedAt: reward.revealedAt ? reward.revealedAt.toISOString() : null,
    };
  });

  const result = {
    id: board.id,
    title: board.title,
    description: board.description,
    totalStickers: board.totalStickers,
    filledCount,
    isCompleted: board.isCompleted,
    allowFriendPlant: board.allowFriendPlant,
    completedAt: board.completedAt,
    createdAt: board.createdAt,
    owner: board.owner,
    giftedTo: board.giftedTo,
    giftedFrom: board.giftedFrom,
    // Gifter's private note → owner/recipient only, never a visiting friend.
    giftMessage: isViewerPrivileged ? board.giftMessage : '',
    giftOpenedAt: board.giftOpenedAt ? board.giftOpenedAt.toISOString() : null,
    // 목록 API의 podong(그룹 전용 배지 의미)과 달리 순차 릴레이 보드도 포함한다.
    inRelay: board.relayParticipants.length > 0,
    // 보상 심기/편집(작성자 행위) 가능 여부 — 선물 복사본·비창시자 포도동 보드는
    // 보상이 타인 작성이라 차단(rewardAccess.ts와 동일 판정, 정책은 서버 한 곳).
    canManageRewards: checkRewardAuthorship(
      { ownerId: board.ownerId, giftedFromId: board.giftedFromId, relayLinks: board.relayParticipants },
      userId,
    ).allowed,
    rewardCount: board.rewards.length,
    stickers: board.stickers,
    rewards,
  };

  return Response.json({ board: result });
}

// Owner-only partial update. Currently just the friend-plant toggle; whitelisted
// so arbitrary fields can't be written. Non-breaking addition (GET/DELETE intact).
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;
  const board = await prisma.board.findUnique({ where: { id }, select: { ownerId: true, isCompleted: true } });
  if (!board) {
    return authResponse('Board not found', 404);
  }
  if (board.ownerId !== userId) {
    return authResponse('Only the board owner can update this board', 403);
  }

  const body = await request.json().catch(() => ({}));
  const data: { allowFriendPlant?: boolean; title?: string; description?: string; harvestedAt?: Date | null } = {};
  if (typeof body?.allowFriendPlant === 'boolean') {
    data.allowFriendPlant = body.allowFriendPlant;
  }
  // 수확(숨김) 토글: 완료된 판만 수확 가능(true). 되돌리기(false)는 항상 허용.
  if (typeof body?.harvested === 'boolean') {
    if (body.harvested && !board.isCompleted) {
      return authResponse('완료된 포도판만 수확할 수 있어요', 400);
    }
    data.harvestedAt = body.harvested ? new Date() : null;
  }
  // 제목/설명 편집 — POST(boards/route.ts)와 동일 검증. stripTitleEmoji는 표시 전용이라 저장경로에 미적용(raw 저장).
  if (typeof body?.title === 'string') {
    if (body.title.trim().length === 0 || body.title.length > 80) {
      return authResponse('제목은 1~80자여야 합니다.', 400);
    }
    data.title = body.title;
  }
  if (typeof body?.description === 'string') {
    if (body.description.length > 200) {
      return authResponse('설명은 200자 이하여야 합니다.', 400);
    }
    data.description = body.description;
  }
  if (Object.keys(data).length === 0) {
    return authResponse('No valid fields to update', 400);
  }

  await prisma.board.update({ where: { id }, data });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;

  const board = await prisma.board.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  if (board.ownerId !== userId) {
    return authResponse('Only the board owner can delete this board', 403);
  }

  await prisma.board.delete({
    where: { id },
  });

  return Response.json({ message: 'Board deleted successfully' });
}
