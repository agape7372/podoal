// 채움 텀(FILL_CADENCE_PLAN §4) 하루/주 경계 계산 — **클라 즉답 UI 전용**(기기 로컬 시간).
//
// C2(2026-07-08)부터 서버 경계의 정본은 src/lib/streak.ts의 zonedDateKey/weekStartKey다
// (User.timezone/dayResetHour 기준 — 텀 판정·스트릭·히트맵 통일). 이 파일은 클라 탭 허용
// 판정(computePaceState)의 즉답용으로만 남는다 — 한국 유저(기기=Asia/Seoul, resetHour 0)
// 에선 두 판정이 일치하고, 어긋나는 극단 케이스(여행 중 등)에도 서버가 authoritative라
// 소프트 모드에선 earlyFill 기록 차이일 뿐 채움 자체는 막히지 않는다.

/**
 * now가 속한 "하루"의 시작 시각 = 로컬 자정 + resetHour. now의 로컬 시각이 resetHour
 * 이전이면 전날 귀속(예: resetHour=4에 새벽 2시 채움 → 어제 몫으로 계산, P14/P22 대응).
 * C2에서 서버 판정(User.timezone/dayResetHour)과 통일 예정 — 지금은 기기 로컬 시간 기준.
 */
export function dayStart(now: Date, resetHour: number = 0): Date {
  const boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour, 0, 0, 0);
  if (now.getTime() < boundary.getTime()) {
    boundary.setDate(boundary.getDate() - 1);
  }
  return boundary;
}

/**
 * 다음 "하루" 경계(= 현재 하루 시작 + 24시간). ripe 재판정 시점(nextRipeAt)으로 쓰인다.
 * C2에서 서버 판정과 통일 예정 — 지금은 기기 로컬 시간 기준.
 */
export function nextDayStart(now: Date, resetHour: number = 0): Date {
  const boundary = dayStart(now, resetHour);
  boundary.setDate(boundary.getDate() + 1);
  return boundary;
}

/**
 * now가 속한 "이번 주"의 시작 시각(월요일 로컬 자정 + resetHour). 일~토(0~6) 기준
 * 월요일까지 역산한다(일요일은 지난주 월요일 소속이 아니라 "이번 주"의 마지막 날).
 * C2에서 서버 판정과 통일 예정 — 지금은 기기 로컬 시간 기준.
 */
export function weekStart(now: Date, resetHour: number = 0): Date {
  const boundary = dayStart(now, resetHour);
  const dow = boundary.getDay(); // 0=일 1=월 … 6=토
  const daysSinceMonday = (dow + 6) % 7;
  boundary.setDate(boundary.getDate() - daysSinceMonday);
  return boundary;
}

/**
 * 다음 "주" 경계(= 이번 주 시작 + 7일). WEEKLY_N의 nextRipeAt으로 쓰인다.
 * C2에서 서버 판정과 통일 예정 — 지금은 기기 로컬 시간 기준.
 */
export function nextWeekStart(now: Date, resetHour: number = 0): Date {
  const boundary = weekStart(now, resetHour);
  boundary.setDate(boundary.getDate() + 7);
  return boundary;
}
