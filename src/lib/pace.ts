// 채움 텀 서버 판정(FILL_CADENCE_PLAN §8, C2) — 순수 함수.
// fillBoard.ts(채움 시점 판정)와 boards 목록(홈 "오늘 몫 완료" 배지)이 공유한다.
// 클라 판정(src/lib/cadence.ts, 기기 로컬)과 달리 User.timezone/dayResetHour 기준 —
// 서버가 authoritative. 경계는 인스턴트가 아니라 날짜키 비교(src/lib/streak.ts 참조).

import { zonedDateKey, weekStartKey } from './streak';

export interface PaceBoardInput {
  cadenceType?: string | null;
  cadenceN?: number | null;
}

export interface ServerPace {
  /** 지금 한 알을 더 채우면 텀 안(ripe)인가 — false면 소프트 오버라이드(early) 대상. */
  ripe: boolean;
  /** 이번 기간(오늘/이번 주) 한도. */
  quota: number;
  /** 이번 기간에 이미 채운 개수(판정 대상 채움 제외). */
  used: number;
}

/**
 * 보드의 텀 상태를 서버 기준으로 판정한다. FREE·미인식 cadenceType이면 null —
 * 호출측은 null이면 텀 개념 자체가 없는 것처럼 동작한다(회귀 0 계약, cadence.ts와 동일).
 * filledAts는 이 보드의 기존 Sticker.filledAt 전부(판정하려는 채움은 포함하지 않음).
 */
export function computeFillPace(
  board: PaceBoardInput,
  filledAts: Date[],
  now: Date,
  timezone: string,
  resetHour: number,
): ServerPace | null {
  const { cadenceType } = board;
  if (!cadenceType || cadenceType === 'FREE') return null;

  let quota: number;
  let inPeriod: (d: Date) => boolean;

  if (cadenceType === 'DAILY_1' || cadenceType === 'DAILY_N') {
    quota = cadenceType === 'DAILY_1' ? 1 : Math.max(1, board.cadenceN ?? 1);
    const todayKey = zonedDateKey(now, timezone, resetHour);
    inPeriod = (d) => zonedDateKey(d, timezone, resetHour) === todayKey;
  } else if (cadenceType === 'WEEKLY_N') {
    quota = Math.max(1, board.cadenceN ?? 1);
    const thisWeekKey = weekStartKey(zonedDateKey(now, timezone, resetHour));
    inPeriod = (d) => weekStartKey(zonedDateKey(d, timezone, resetHour)) === thisWeekKey;
  } else {
    // 미인식 타입 — 실패 열림(cadence.ts와 동일한 처벌 금지 원칙).
    return null;
  }

  const used = filledAts.reduce((n, d) => (inPeriod(d) ? n + 1 : n), 0);
  return { ripe: used < quota, quota, used };
}
