// 채움 텀 서버 판정(FILL_CADENCE_PLAN §8, C2) — 순수 함수.
// fillBoard.ts(채움 시점 판정)와 boards 목록(홈 "오늘 몫 완료" 배지)이 공유한다.
// 클라 판정(src/lib/cadence.ts, 기기 로컬)과 달리 User.timezone/dayResetHour 기준 —
// 서버가 authoritative. 경계는 인스턴트가 아니라 날짜키 비교(src/lib/streak.ts 참조).
//
// C3(보충 채우기): 채움의 "귀속일"은 filledAt의 날짜키가 기본이되, isBackfill 스티커는
// 하루 앞(전날)으로 귀속된다 — 보충은 항상 "어제 몫"만 허용되므로 채운 날의 전날이 대상일.
// 이 귀속 규칙은 텀 판정(여기)·통계 버킷팅(/api/stats SQL)·보충 자격 판정이 공유한다.

import { zonedDateKey, weekStartKey, shiftDateKey } from './streak';

export interface PaceBoardInput {
  cadenceType?: string | null;
  cadenceN?: number | null;
}

/** 판정 입력 채움 1건 — isBackfill이면 귀속일이 filledAt의 전날. */
export interface PaceFill {
  filledAt: Date;
  isBackfill?: boolean;
}

export interface ServerPace {
  /** 지금 한 알을 더 채우면 텀 안(ripe)인가 — false면 소프트 오버라이드(early) 대상. */
  ripe: boolean;
  /** 이번 기간(오늘/이번 주) 한도. */
  quota: number;
  /** 이번 기간에 이미 채운 개수(판정 대상 채움 제외). */
  used: number;
}

/** 채움 1건의 귀속 날짜키 — backfill은 전날. */
function fillDateKey(fill: PaceFill, timezone: string, resetHour: number): string {
  const key = zonedDateKey(fill.filledAt, timezone, resetHour);
  return fill.isBackfill ? shiftDateKey(key, -1) : key;
}

/**
 * 보드의 텀 상태를 서버 기준으로 판정한다. FREE·미인식 cadenceType이면 null —
 * 호출측은 null이면 텀 개념 자체가 없는 것처럼 동작한다(회귀 0 계약, cadence.ts와 동일).
 * fills는 이 보드의 기존 스티커 전부(판정하려는 채움은 포함하지 않음).
 */
export function computeFillPace(
  board: PaceBoardInput,
  fills: PaceFill[],
  now: Date,
  timezone: string,
  resetHour: number,
): ServerPace | null {
  const { cadenceType } = board;
  if (!cadenceType || cadenceType === 'FREE') return null;

  let quota: number;
  let inPeriod: (key: string) => boolean;

  if (cadenceType === 'DAILY_1' || cadenceType === 'DAILY_N') {
    quota = cadenceType === 'DAILY_1' ? 1 : Math.max(1, board.cadenceN ?? 1);
    const todayKey = zonedDateKey(now, timezone, resetHour);
    inPeriod = (key) => key === todayKey;
  } else if (cadenceType === 'WEEKLY_N') {
    quota = Math.max(1, board.cadenceN ?? 1);
    const thisWeekKey = weekStartKey(zonedDateKey(now, timezone, resetHour));
    inPeriod = (key) => weekStartKey(key) === thisWeekKey;
  } else {
    // 미인식 타입 — 실패 열림(cadence.ts와 동일한 처벌 금지 원칙).
    return null;
  }

  const used = fills.reduce(
    (n, f) => (inPeriod(fillDateKey(f, timezone, resetHour)) ? n + 1 : n),
    0,
  );
  return { ripe: used < quota, quota, used };
}

/**
 * 보충 채우기(backfill, FILL_CADENCE §5) 자격 판정 — DAILY 계열 전용.
 * "어제 몫"이 미달이면 어제의 다음 날(오늘)이 끝나기 전까지 1알에 한해 보충을 허용한다
 * (§5 "어제 시작으로부터 48시간" = 어제+오늘). 반환 null = 텀 개념 없음(FREE/WEEKLY/미인식).
 *
 * 자격 조건(전부 충족):
 * 1. 어제 귀속 채움 수 < 어제 quota (몫 미달)
 * 2. 어제 귀속 backfill 스티커 없음 (보충은 하루 1알)
 * 3. 그저께·그그저께가 연속으로 backfill 귀속이 아님 (연속 2일 보충 시 3일째 미제공 — §5 남용 방어)
 * 4. 보드가 어제 이미 존재했음 (createdAt 귀속키 ≤ 어제 — 오늘 만든 보드에 "어제 몫"은 없다)
 */
export function computeBackfillEligibility(
  board: PaceBoardInput & { createdAt?: Date | null },
  fills: PaceFill[],
  now: Date,
  timezone: string,
  resetHour: number,
): { eligible: boolean; targetDateKey: string } | null {
  const { cadenceType } = board;
  if (cadenceType !== 'DAILY_1' && cadenceType !== 'DAILY_N') return null;

  const quota = cadenceType === 'DAILY_1' ? 1 : Math.max(1, board.cadenceN ?? 1);
  const todayKey = zonedDateKey(now, timezone, resetHour);
  const targetDateKey = shiftDateKey(todayKey, -1); // 어제

  // 조건 4 — createdAt 미전달(레거시 호출)은 관대하게 통과(실패 열림).
  if (board.createdAt && zonedDateKey(board.createdAt, timezone, resetHour) > targetDateKey) {
    return { eligible: false, targetDateKey };
  }

  let usedYesterday = 0;
  let backfilledYesterday = false;
  const backfillDays = new Set<string>();
  for (const f of fills) {
    const key = fillDateKey(f, timezone, resetHour);
    if (key === targetDateKey) {
      usedYesterday++;
      if (f.isBackfill) backfilledYesterday = true;
    }
    if (f.isBackfill) backfillDays.add(key);
  }

  const consecutiveAbuse =
    backfillDays.has(shiftDateKey(targetDateKey, -1)) &&
    backfillDays.has(shiftDateKey(targetDateKey, -2));

  return {
    eligible: usedYesterday < quota && !backfilledYesterday && !consecutiveAbuse,
    targetDateKey,
  };
}
