// 채움 텀(FILL_CADENCE_PLAN §4) 하루/주 경계 계산 — 단일 유틸(이중 구현 금지의 기점).
// 스트릭·히트맵·시간캡슐 D-day 판정도 장기적으로 이 유틸에 합류할 예정(§4 리스크 레지스터).
//
// C1은 기기 로컬 시간을 사용한다(resetHour 기본 0 = 자정 경계). User.timezone/User.dayResetHour
// 서버 판정과의 통일은 C2에서 진행 — 그 전까지 클라 판정만 이 함수를 소비한다(computePaceState).

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
