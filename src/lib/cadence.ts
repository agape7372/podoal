// 채움 텀(FILL_CADENCE_PLAN §2·§3) 판정 — 클라 "탭 허용 앞단" 전용(§1.5).
// 서버 판정(응답 paceState 필드)은 C2에서 도입 — 지금은 표시·탭 가드 전용이며
// mergeServerBoard/applyFillResult/낙관 큐/isJustFilled 600ms 창과 완전히 분리돼 있다
// (호출측이 이 결과를 어디에 쓰든 boardFillState.ts의 산식은 무관하게 그대로 작동).
import { dayStart, nextDayStart, weekStart, nextWeekStart } from './dayBoundary';

export interface PaceState {
  /** 다음 알이 지금 채울 수 있는 상태인가(익음). false면 소프트 가드 대상(RipeningSheet). */
  ripe: boolean;
  /** 이번 기간(오늘/이번 주)의 채움 한도. */
  quota: number;
  /** 이번 기간에 이미 채운 개수. */
  used: number;
  /** 다음에 다시 익는 시각. ripe면 null(이미 익어 있어 판정 불필요). */
  nextRipeAt: Date | null;
  /** 익음 정도 0~1(연출용 --ripen-p). ripe면 1. */
  progress: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * 보드의 채움 텀 상태를 계산한다. cadenceType이 없거나 'FREE'(및 인식하지 못하는 값)면
 * null — 호출측은 null이면 현행 동작 그대로 유지한다(회귀 0의 계약, FREE 보드·릴레이·
 * 선물 보드는 이 함수를 거치지 않은 것과 동일하게 동작).
 *
 * stickerTimes는 이 보드의 전체 Sticker.filledAt(오름차순 불필요, 내부에서 기간 필터링).
 * now는 호출측이 (컴포넌트 렌더가 아닌) 이벤트 핸들러/effect에서 캡처해 넘겨야 한다
 * (react-hooks/purity — 이 함수 자체는 인자로만 시각을 받는 순수 함수).
 */
export function computePaceState(
  board: { cadenceType?: string; cadenceN?: number | null },
  stickerTimes: Date[],
  now: Date,
): PaceState | null {
  const { cadenceType } = board;
  if (!cadenceType || cadenceType === 'FREE') return null;

  let periodStart: Date;
  let periodEnd: Date;
  let quota: number;

  if (cadenceType === 'DAILY_1') {
    quota = 1;
    periodStart = dayStart(now);
    periodEnd = nextDayStart(now);
  } else if (cadenceType === 'DAILY_N') {
    quota = Math.max(1, board.cadenceN ?? 1);
    periodStart = dayStart(now);
    periodEnd = nextDayStart(now);
  } else if (cadenceType === 'WEEKLY_N') {
    quota = Math.max(1, board.cadenceN ?? 1);
    periodStart = weekStart(now);
    periodEnd = nextWeekStart(now);
  } else {
    // 인식하지 못하는 cadenceType — 실패 열림(FREE 취급). 처벌 금지 원칙(§1): 알 수
    // 없는 데이터로 채움을 잠그지 않는다.
    return null;
  }

  const periodStartMs = periodStart.getTime();
  const periodEndMs = periodEnd.getTime();
  const inPeriod = stickerTimes.filter((t) => {
    const ms = t.getTime();
    return ms >= periodStartMs && ms < periodEndMs;
  });
  const used = inPeriod.length;
  const ripe = used < quota;
  const nextRipeAt = ripe ? null : periodEnd;

  let progress: number;
  if (ripe) {
    progress = 1;
  } else {
    // ripe=false ⇒ used>=quota>=1 ⇒ inPeriod에 최소 1개 존재(아래 Math.max 안전).
    const lastFillMs = Math.max(...inPeriod.map((t) => t.getTime()));
    const span = periodEndMs - lastFillMs;
    progress = span <= 0 ? 1 : clamp01((now.getTime() - lastFillMs) / span);
  }

  return { ripe, quota, used, nextRipeAt, progress };
}
