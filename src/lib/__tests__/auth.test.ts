import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// auth.ts는 모듈 로드 시 JWT_SECRET(≥16자)을 요구한다. CJS(top-level await 불가) 환경이라
// before 훅에서 env 주입 후 동적 import한다.
let createToken: (id: string) => Promise<string>;
let verifyToken: (t: string) => Promise<{ userId: string } | null>;
let buildAuthCookie: (t: string) => string;
let buildClearAuthCookie: () => string;

before(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars-long';
  ({ createToken, verifyToken, buildAuthCookie, buildClearAuthCookie } = await import('../auth'));
});

test('createToken → verifyToken 라운드트립', async () => {
  const token = await createToken('user-123');
  assert.equal(typeof token, 'string');
  const result = await verifyToken(token);
  assert.deepEqual(result, { userId: 'user-123' });
});

test('verifyToken: 변조된 토큰은 null', async () => {
  const token = await createToken('user-123');
  // 서명 마지막 글자를 바꿔 변조
  const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  assert.equal(await verifyToken(tampered), null);
});

test('verifyToken: 형식이 깨진 토큰은 null', async () => {
  assert.equal(await verifyToken('not-a-jwt'), null);
  assert.equal(await verifyToken(''), null);
  assert.equal(await verifyToken('a.b.c'), null);
});

test('buildAuthCookie: HttpOnly·Path·SameSite·Max-Age 포함, 개발 환경엔 Secure 없음', () => {
  const cookie = buildAuthCookie('tok123');
  assert.match(cookie, /^token=tok123/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=604800/); // 7일
  assert.equal(/Secure/.test(cookie), process.env.NODE_ENV === 'production');
});

test('buildClearAuthCookie: Max-Age=0으로 즉시 만료', () => {
  const cookie = buildClearAuthCookie();
  assert.match(cookie, /^token=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
});
