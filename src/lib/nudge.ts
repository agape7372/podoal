// 데일리 넛지 발송 자격 판정 — opt-in(dailyNudgeEnabled) + KST 하루 1회(lastNudgeSentAt).
// 크론(daily-nudge)에서 호출하는 순수 함수. KST 날짜 비교는 reminders 크론의
// kstDateOf(lastSentAt) 패턴과 동일하다(새 방식 발명 금지).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateOf(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().split('T')[0];
}

export interface NudgeSetting {
  dailyNudgeEnabled: boolean;
  lastNudgeSentAt: Date | null;
}

/**
 * 데일리 넛지를 보내도 되는가?
 * - 설정 행이 없으면(null/undefined) 미발송 — opt-in이므로 행 없음 = 동의 없음.
 * - dailyNudgeEnabled가 꺼져 있으면 미발송.
 * - lastNudgeSentAt이 now와 같은 KST 날짜면 미발송(크론 중복 실행 가드).
 */
export function shouldSendNudge(
  setting: NudgeSetting | null | undefined,
  now: Date,
): boolean {
  if (!setting || !setting.dailyNudgeEnabled) return false;
  if (setting.lastNudgeSentAt && kstDateOf(setting.lastNudgeSentAt) === kstDateOf(now)) {
    return false;
  }
  return true;
}
