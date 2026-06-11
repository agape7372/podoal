import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, clientKey } from '../rateLimit';

// rateLimit.ts는 모듈 로드 시점에 UPSTASH env를 읽는다. env가 설정돼 있으면
// in-memory 경로가 아예 실행되지 않으므로 아래 in-memory 테스트는 건너뛴다.
// (표준 테스트 환경/CI에는 UPSTASH env가 없어 in-memory 모드로 돈다.)
const upstashEnabled = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);
const skipInMemory = upstashEnabled
  ? 'UPSTASH env 설정됨 — in-memory 경로가 비활성이라 건너뜀'
  : false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('in-memory: 한도 내 요청은 null(통과)', { skip: skipInMemory }, async () => {
  const check = rateLimit({ windowMs: 60_000, max: 3 });
  assert.equal(await check('k-under-1'), null);
  assert.equal(await check('k-under-1'), null);
  assert.equal(await check('k-under-1'), null);
});

test('in-memory: 한도 초과 시 429 + Retry-After 헤더', { skip: skipInMemory }, async () => {
  const check = rateLimit({ windowMs: 60_000, max: 2, message: '잠시 후 다시 시도해주세요' });
  assert.equal(await check('k-over'), null);
  assert.equal(await check('k-over'), null);

  const blocked = await check('k-over');
  assert.ok(blocked instanceof Response, '초과 시 Response를 반환해야 함');
  assert.equal(blocked.status, 429);

  const retryAfter = Number(blocked.headers.get('Retry-After'));
  assert.ok(Number.isFinite(retryAfter) && retryAfter >= 1, 'Retry-After는 1초 이상');
  assert.ok(retryAfter <= 60, 'Retry-After는 윈도우 길이를 넘지 않음');

  const body = (await blocked.json()) as { error: string };
  assert.equal(body.error, '잠시 후 다시 시도해주세요');
});

test('in-memory: 키가 다르면 카운터가 격리된다', { skip: skipInMemory }, async () => {
  const check = rateLimit({ windowMs: 60_000, max: 1 });
  assert.equal(await check('k-iso-a'), null);
  assert.notEqual(await check('k-iso-a'), null, '같은 키 2번째는 차단');
  assert.equal(await check('k-iso-b'), null, '다른 키는 영향 없음');
});

test('in-memory: 윈도우 경과 후 카운터가 리셋된다', { skip: skipInMemory }, async () => {
  // node:test에는 fake timer가 없어 실제 짧은 sleep으로 윈도우를 흘려보낸다.
  const windowMs = 150;
  const check = rateLimit({ windowMs, max: 1 });
  assert.equal(await check('k-reset'), null);
  assert.notEqual(await check('k-reset'), null, '윈도우 내 2번째는 차단');

  await sleep(windowMs + 50);
  assert.equal(await check('k-reset'), null, '윈도우 경과 후엔 다시 통과');
});

test('clientKey: x-forwarded-for의 첫 IP를 추출한다', () => {
  const req = new Request('http://test.local', {
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.9.9.9' },
  });
  assert.equal(clientKey(req), '1.2.3.4');
});

test('clientKey: x-forwarded-for 없으면 x-real-ip, 둘 다 없으면 unknown', () => {
  const realIp = new Request('http://test.local', {
    headers: { 'x-real-ip': '10.0.0.1' },
  });
  assert.equal(clientKey(realIp), '10.0.0.1');

  const bare = new Request('http://test.local');
  assert.equal(clientKey(bare), 'unknown');
});

test('clientKey: x-forwarded-for 첫 항목이 비어 있으면 x-real-ip로 폴백', () => {
  const req = new Request('http://test.local', {
    headers: { 'x-forwarded-for': ' , 9.9.9.9', 'x-real-ip': '10.0.0.2' },
  });
  assert.equal(clientKey(req), '10.0.0.2');
});

// Upstash(Redis REST) 경로는 외부 네트워크가 필요해 표준 스위트에서 검증하지 않는다.
// UPSTASH_REDIS_REST_URL/TOKEN이 설정된 환경에서만 스모크로 동작 확인.
test(
  'upstash: env 설정 시 check가 null 또는 429 Response를 반환한다 (스모크)',
  { skip: upstashEnabled ? false : 'UPSTASH env 미설정 — Upstash 경로 건너뜀' },
  async () => {
    const check = rateLimit({ windowMs: 60_000, max: 1000 });
    const result = await check(`k-upstash-smoke-${Date.now()}`);
    assert.ok(result === null || (result instanceof Response && result.status === 429));
  },
);
