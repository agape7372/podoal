import { buildClearAuthCookie } from '@/lib/auth';

// 로그아웃 전용 라우트(W1-D). POST /api/auth/me도 역사적으로 쿠키를 지우지만,
// 의미가 겹치는 URL(me에 POST = 로그아웃)은 클라이언트 코드에서 읽히지 않아
// 명시적 경로를 추가한다(additive — 기존 me POST는 그대로 둔다).
// 인증 불요: 이미 로그아웃 상태여도 200 — 멱등.
export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.set('Set-Cookie', buildClearAuthCookie());
  return response;
}
