// 서버 날짜키(경계) 판정 순수 함수 모음 — 채움 텀 C2에서 서버 경계의 단일 정본이 됨.
// 스트릭·히트맵(/api/stats)·텀 판정(fillBoard/pace.ts)이 전부 이 모듈의 키 함수를 쓴다.
// 클라이언트는 절대 재계산하지 않고 서버 응답만 표시한다(타임존 어긋남 방지).
// (src/lib/dayBoundary.ts는 클라 즉답 UI 전용 — C1 계약 유지, 서버 정본은 여기.)

// KST(Asia/Seoul, UTC+9, DST 없음). 기본 날짜 버킷팅은 KST 기준 —
// 23:30 KST에 채운 포도알은 그 달력 날짜에 속해야 한다.
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;

// ─── 시간대 인지 날짜키 (채움 텀 C2, FILL_CADENCE §4) ─────────────────────────
// 경계 "인스턴트"를 계산하지 않는다 — 소속 판정은 전부 날짜키 비교로 한다(DAILY=같은 키,
// WEEKLY=같은 weekStartKey). ISO 키는 사전순=시간순이라 범위 비교도 문자열로 안전.
// 등가 계약: zonedDateKey(d, 'Asia/Seoul', 0) === kstDateKey(d) — 단위 테스트로 고정.

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = dtfCache.get(timezone);
  if (!fmt) {
    try {
      // en-CA locale은 YYYY-MM-DD 형식을 그대로 낸다.
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      // 미지/오염된 IANA 문자열 — 실패 열림으로 KST 폴백(처벌 금지 원칙: 잘못된
      // 설정값으로 판정을 깨지 않는다).
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
    dtfCache.set(timezone, fmt);
  }
  return fmt;
}

/**
 * instant가 timezone에서 속하는 달력 날짜 키(YYYY-MM-DD). resetHour(0~6)는 "하루의
 * 시작 시각" — 그 시각 이전은 전날 귀속(새벽 채움 P14/P22 대응). 구현: instant를
 * resetHour만큼 뒤로 민 뒤 그 시각의 timezone 달력 날짜를 취한다.
 */
export function zonedDateKey(instant: Date, timezone = 'Asia/Seoul', resetHour = 0): string {
  const shifted = resetHour > 0 ? new Date(instant.getTime() - resetHour * 3_600_000) : instant;
  return zonedFormatter(timezone).format(shifted);
}

/**
 * 날짜 키가 속한 주의 시작(월요일) 키. 요일은 키를 UTC로 파싱해 얻는다 — 키 자체가
 * 이미 시간대 귀속을 끝낸 달력 날짜라 순수 문자열 산술(시간대 무관).
 */
export function weekStartKey(dateKey: string): string {
  const dow = new Date(Date.parse(`${dateKey}T00:00:00Z`)).getUTCDay(); // 0=일 1=월 … 6=토
  const daysSinceMonday = (dow + 6) % 7;
  return shiftDateKey(dateKey, -daysSinceMonday);
}

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

/**
 * 현재/최장 스트릭 계산. dateKeys에는 실제 채운 날짜 + (폐지된 유예 기능을 과거에
 * 사용한 계정이라면) 레거시 유예 날짜가 들어온다 — 주입 경로는 /api/stats 참조.
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
