import { createHash, timingSafeEqual } from 'crypto';

// cron Bearer 토큰 상수시간 검증(B2). GitHub Actions가 보내는
// `Authorization: Bearer <CRON_SECRET>` 헤더를 타이밍 사이드채널 없이 비교한다.
// (기존 `authHeader !== \`Bearer ${secret}\`` 는 조기 종료로 문자 단위 타이밍이 샜다.)
//
// 응답 계약(미설정 503 / 불일치 401)은 호출 라우트가 유지한다: 라우트가 먼저
// `process.env.CRON_SECRET` 존재를 확인해 503을 내고, 이 함수는 불일치(401) 판정만
// 담당한다. 그래도 이 함수 자체는 secret 미설정 시 방어적으로 false를 반환한다.
//
// timingSafeEqual은 길이가 다르면 throw하므로, 양측을 sha256으로 고정 길이(32B)
// 해시한 뒤 비교한다 — 길이 자체도 노출하지 않는다.

/**
 * cron 요청의 Authorization 헤더가 `Bearer <CRON_SECRET>` 와 정확히 일치하는지
 * 상수시간으로 검증한다. CRON_SECRET이 설정돼 있고 헤더가 일치할 때만 true.
 */
export function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}
