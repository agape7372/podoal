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
  // payload 세그먼트 첫 글자를 바꿔 변조 — 서명 대상(header.payload)이 달라져 서명이 항상
  // 불일치한다. (서명 끝 글자만 뒤집으면 base64url 미사용 비트 때문에 같은 서명으로 디코드돼 flaky)
  const parts = token.split('.');
  parts[1] = (parts[1][0] === 'a' ? 'b' : 'a') + parts[1].slice(1);
  assert.equal(await verifyToken(parts.join('.')), null);
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
