// 동결건조(타임캡슐) 개봉시각 규칙 — 순수 함수.
// 생성 라우트(boards/[id]/capsules POST)의 파싱·미래검증과
// 개봉 판정(capsules/[id]/open 서버 / CapsuleModal 클라)이 같은 규칙을 공유한다.
//
// 배경 버그: <input type=date>의 'YYYY-MM-DD'를 그대로 new Date()하면 UTC 자정
// = KST 09:00에 개봉되는 버그가 있었음. 선택한 날짜의 KST 자정(00:00 +09:00)으로
// 해석해 그 날 0시에 열리게 한다. 판정은 양쪽 모두 정밀 타임스탬프 비교(날짜단위 X).

export type ParseOpenAtResult =
  | { ok: true; date: Date }
  | { ok: false; reason: 'invalid' | 'notFuture' };

/**
 * openAt 입력 파싱 + 미래 검증.
 * - 'YYYY-MM-DD'(date input)는 그 날짜의 KST 자정(+09:00) 인스턴트로 해석.
 * - 그 외 문자열은 일반 Date 파싱(타임스탬프 포함 ISO 등).
 * - 파싱 실패 → 'invalid', now 이하(과거·오늘 KST 자정 포함) → 'notFuture'.
 */
export function parseOpenAtKst(openAt: string, now: number): ParseOpenAtResult {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(openAt);
  const date = dateOnly ? new Date(`${openAt}T00:00:00+09:00`) : new Date(openAt);
  if (isNaN(date.getTime())) {
    return { ok: false, reason: 'invalid' };
  }
  // 미래여야 함(이미 KST 자정 인스턴트라 오늘 선택 시 now보다 과거 → 거부, 내일+ 만 통과).
  if (date.getTime() <= now) {
    return { ok: false, reason: 'notFuture' };
  }
  return { ok: true, date };
}

/**
 * 개봉 가능 판정 — 정밀 타임스탬프 비교. 서버(/open)와 클라(CapsuleModal)가 동일 사용.
 * 호출부가 now를 주입한다(렌더 중 현재시각 호출 제약은 호출부 책임 —
 * react-hooks/purity 때문에 클라 렌더에서는 `new Date().getTime()` 사용).
 */
export function isCapsuleOpenable(openAt: Date | string, now: number): boolean {
  const openAtMs = openAt instanceof Date ? openAt.getTime() : new Date(openAt).getTime();
  return now >= openAtMs;
}
