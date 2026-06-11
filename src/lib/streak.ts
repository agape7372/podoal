// 스트릭(연속 기록) KST 날짜·유예(freeze) 판정 순수 함수 모음.
// 서버 라우트(/api/stats, /api/streak/freeze)와 단위 테스트가 공유한다 —
// 클라이언트는 절대 재계산하지 않고 서버 응답만 표시한다(타임존 어긋남 방지).

// KST(Asia/Seoul, UTC+9, DST 없음). 모든 날짜 버킷팅은 KST 기준 —
// 23:30 KST에 채운 포도알은 그 달력 날짜에 속해야 한다.
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;

/** 주어진 시각이 KST에서 속하는 달력 날짜 키(YYYY-MM-DD). */
export function kstDateKey(d: Date): string {
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  return shifted.toISOString().split('T')[0];
}

/** 오늘(KST)의 날짜 키. 테스트를 위해 기준 시각 주입 가능. */
export function kstTodayKey(nowMs: number = Date.now()): string {
  return kstDateKey(new Date(nowMs));
}

/** 날짜 키를 days만큼 이동(음수 = 과거). 월/년 경계 안전. */
export function shiftDateKey(key: string, days: number): string {
  const t = Date.parse(`${key}T00:00:00Z`);
  return new Date(t + days * DAY_MS).toISOString().split('T')[0];
}

/** KST 달력 날짜 키 하나가 덮는 UTC 시각 구간 [start, end). DB 범위 쿼리용. */
export function kstDayRangeUtc(key: string): { start: Date; end: Date } {
  const startMs = Date.parse(`${key}T00:00:00Z`) - KST_OFFSET_MS;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

export type FreezeReason = 'ok' | 'already-used' | 'yesterday-filled' | 'no-anchor';

export interface FreezeVerdict {
  eligible: boolean;
  reason: FreezeReason;
}

/**
 * 유예(freeze) 1회 자격 판정.
 * 조건: ① 아직 유예 미사용 ② 어제(KST)가 비어 있음 ③ 그제는 채워져 있음
 * (= 어제 하루만 메꾸면 스트릭이 이어붙는 상태).
 */
export function canFreeze(
  filledDates: ReadonlySet<string>,
  freezeUsedAt: Date | string | null,
  todayKey: string,
): FreezeVerdict {
  if (freezeUsedAt) return { eligible: false, reason: 'already-used' };
  const yesterday = shiftDateKey(todayKey, -1);
  if (filledDates.has(yesterday)) return { eligible: false, reason: 'yesterday-filled' };
  const dayBefore = shiftDateKey(todayKey, -2);
  if (!filledDates.has(dayBefore)) return { eligible: false, reason: 'no-anchor' };
  return { eligible: true, reason: 'ok' };
}

/**
 * 현재/최장 스트릭 계산. dateKeys에는 실제 채운 날짜 + (사용했다면) 유예 날짜가 들어온다.
 *
 * 오늘은 아직 '진행 중'인 날 — 오늘 칸이 비어 있어도 어제까지의 연속은 끊긴 게 아니다
 * (자정 전까지 기회가 남아 있다). 그래서 오늘이 비어 있으면 어제를 기준으로 거꾸로 센다.
 * 처벌 없는 정서 톤: "아직 안 채웠을 뿐"인 아침에 0일로 보이지 않게 한다.
 */
export function computeStreaks(
  dateKeys: Iterable<string>,
  todayKey: string,
): { currentStreak: number; longestStreak: number } {
  const set = new Set(dateKeys);

  const sorted = Array.from(set).sort();
  let longestStreak = 0;
  let temp = 0;
  for (let i = 0; i < sorted.length; i++) {
    temp = i > 0 && shiftDateKey(sorted[i - 1], 1) === sorted[i] ? temp + 1 : 1;
    if (temp > longestStreak) longestStreak = temp;
  }

  let currentStreak = 0;
  let cursor = set.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  while (set.has(cursor)) {
    currentStreak++;
    cursor = shiftDateKey(cursor, -1);
  }

  return { currentStreak, longestStreak };
}
