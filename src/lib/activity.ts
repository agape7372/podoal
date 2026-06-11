// 친구 활동 피드 표시용 순수 유틸 + 타입.
// formatRelativeTime은 react-hooks/purity(렌더 중 현재시각 호출 금지)를 지키기 위해
// `now`를 인자로 받는다 — 호출부는 fetch 시점(effect/핸들러)에 잡아둔 타임스탬프를 넘긴다.

export interface FriendActivity {
  boardId: string;
  title: string;
  totalStickers: number;
  completedAt: string;
  actor: { id: string; name: string; avatar: string };
}

/**
 * ISO 시각 → '방금'/'N분 전'/'N시간 전'/'N일 전' (알림 인박스의 timeAgo와 동일 표기).
 * 피드 윈도우가 7일이라 '일 전'까지만 다룬다. 미래 시각·시계 오차는 '방금'으로 클램프,
 * 파싱 불가 입력은 빈 문자열을 돌려 UI에서 조용히 생략한다.
 */
export function formatRelativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMin = Math.floor(Math.max(0, now - t) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}
