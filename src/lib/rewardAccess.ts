// 보상 편집(작성자용 GET/PATCH/DELETE·심기 POST) 접근 판정 — 라우트·단위테스트 공유.
//
// 배경: 선물(giftBoard.ts)과 포도동 join(relays/[id]/join)은 "보드 복사 + ownerId 이전"
// 모델이라 복사본에서는 받는 사람이 곧 owner다. Reward에는 작성자 필드가 없어
// "owner = 보상 작성자" 가정이 깨진다 — 받는 사람이 편집용 reward GET으로 잠긴
// 서프라이즈 본문을 선열람/수정/삭제할 수 있었다(2026-06-13 #89 후속 결함).
//
// 수정: 보드 출처로 작성자성을 근사한다. 선물 복사본(giftedFromId != null)과
// 내가 만들지 않은 포도동에 연결된 보드의 보상은 전부 타인 작성으로 간주해 차단.
// (포도동 창시자의 템플릿 보드는 본인 작성이므로 허용. 자기 보드를 attach한
// 참가자는 과차단되지만 — 연결 중 보상 편집 불가 — 비밀 유지가 우선인 안전 기본값.)
export type RewardOriginBoard = {
  ownerId: string;
  giftedFromId: string | null;
  /** board.relayParticipants — join의 BOARD_IN_USE 가드로 보드당 최대 1개. */
  relayLinks: Array<{ relay: { creatorId: string } }>;
};

export type RewardAuthorshipVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'not-owner' | 'gifted' | 'relay' };

/** userId가 이 보드의 보상을 "작성자로서" 다룰 수 있는지 판정한다. */
export function checkRewardAuthorship(
  board: RewardOriginBoard,
  userId: string,
): RewardAuthorshipVerdict {
  if (board.ownerId !== userId) {
    return { allowed: false, reason: 'not-owner' };
  }
  // 선물 복사본 — 보상은 선물한 친구의 서프라이즈(giftBoardCopy가 잠김으로 복사).
  if (board.giftedFromId !== null) {
    return { allowed: false, reason: 'gifted' };
  }
  // 포도동 연결 보드 — join이 창시자 보드의 보상을 복사한다. 창시자 본인만 작성자.
  if (board.relayLinks.some((link) => link.relay.creatorId !== userId)) {
    return { allowed: false, reason: 'relay' };
  }
  return { allowed: true };
}
