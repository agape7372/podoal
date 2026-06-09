// 보상 배열 검증 — boards POST 와 relays POST 가 동일 규칙을 쓰도록 공유.
// 유효하면 null, 아니면 한국어 에러 메시지를 반환한다.

const VALID_REWARD_TYPES = new Set(['letter', 'giftcard', 'wish']);

type RawReward = {
  type?: unknown;
  title?: unknown;
  content?: unknown;
  triggerAt?: unknown;
  imageUrl?: unknown;
};

export function validateRewards(rewards: unknown, totalStickers: number): string | null {
  if (!Array.isArray(rewards) || rewards.length === 0 || rewards.length > 10) {
    return '보상은 1~10개여야 합니다.';
  }
  for (const r of rewards as RawReward[]) {
    if (
      typeof r.type !== 'string' ||
      !VALID_REWARD_TYPES.has(r.type) ||
      typeof r.title !== 'string' ||
      r.title.trim().length === 0 ||
      r.title.length > 80 ||
      typeof r.content !== 'string' ||
      r.content.length > 500 ||
      typeof r.triggerAt !== 'number'
    ) {
      return '보상 형식이 올바르지 않습니다.';
    }
    if (!Number.isInteger(r.triggerAt) || r.triggerAt < 1 || r.triggerAt > totalStickers) {
      return `triggerAt은 1~${totalStickers} 사이의 정수여야 합니다.`;
    }
    if (r.imageUrl !== undefined && (typeof r.imageUrl !== 'string' || r.imageUrl.length > 1024)) {
      return 'imageUrl이 올바르지 않습니다.';
    }
  }
  const triggerAts = (rewards as RawReward[]).map((r) => r.triggerAt as number);
  if (new Set(triggerAts).size !== triggerAts.length) {
    return '각 보상의 triggerAt 값은 달라야 합니다.';
  }
  return null;
}
