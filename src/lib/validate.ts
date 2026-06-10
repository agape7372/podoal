// API 라우트 입력 검증 헬퍼 — 잘못된 입력에 500(Prisma 타입 에러 등)이 아니라 400을
// 내도록 한다. 라우트마다 흩어진 즉석 검사 대신 공통 가드를 쓴다.

/** 비어있지 않은 문자열(트림 기준) + 선택적 최대 길이(원문 length 기준). */
export function isNonEmptyString(v: unknown, max = Infinity): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/** 없거나(undefined/null) 길이 제한 내 문자열. (type guard로 호출부 내로잉 지원) */
export function isOptString(v: unknown, max = Infinity): v is string | null | undefined {
  return v === undefined || v === null || (typeof v === 'string' && v.length <= max);
}

/** 엄격 boolean. */
export function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

/** 24시간 'HH:MM' 시각 문자열(00:00~23:59). */
export function isHHMM(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** request.json()이 객체를 돌려줬는지(배열/원시/널 거부). */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
