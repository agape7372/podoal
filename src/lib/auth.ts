import { SignJWT, jwtVerify } from 'jose';
// `next/headers`는 `server-only`를 import해 서버 요청 스코프 밖(테스트·번들)에서 throw한다.
// 이 모듈의 순수 토큰 함수(createToken/verifyToken/cookie 빌더)를 단위테스트할 수 있도록
// 최상위 import 대신 getCurrentUserId 내부에서 동적 import한다(런타임 동작 동일).

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 16) {
  throw new Error(
    'JWT_SECRET environment variable is required (min 16 chars). ' +
      'Set it in .env / .env.local before starting the app. ' +
      'See .env.example for a template.',
  );
}
const JWT_SECRET = new TextEncoder().encode(rawSecret);

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await verifyToken(token);
  return result?.userId ?? null;
}

export function authResponse(message: string, status: number = 401) {
  return Response.json({ error: message }, { status });
}

export function buildAuthCookie(token: string): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearAuthCookie(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function applyAuthCookie(response: Response, token: string): Response {
  response.headers.set('Set-Cookie', buildAuthCookie(token));
  return response;
}
