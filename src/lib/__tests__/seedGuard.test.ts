import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDbTarget,
  isLoopbackHost,
  describeTarget,
  assertSeedAllowed,
  assertBaselineAllowed,
} from '../seedGuard';

const LOCAL = 'postgresql://podoal:podoal@localhost:55432/podoal?schema=public';
const NEON = 'postgresql://owner:npg_secret@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

test('parseDbTarget: host/port/database만 뽑고 자격증명은 반환하지 않는다', () => {
  const t = parseDbTarget(LOCAL);
  assert.deepEqual(t, { host: 'localhost', port: '55432', database: 'podoal' });
  // 반환 객체 어디에도 비밀번호가 없어야 한다(로그 유출 방지).
  assert.equal(JSON.stringify(t).includes('podoal:podoal'), false);
});

test('parseDbTarget: 포트 생략 시 5432 기본값', () => {
  assert.equal(parseDbTarget('postgres://u@db.example.com/mydb')?.port, '5432');
});

test('parseDbTarget: 파싱 불가·비-postgres 스킴·DB명 부재는 null', () => {
  assert.equal(parseDbTarget(undefined), null);
  assert.equal(parseDbTarget(''), null);
  assert.equal(parseDbTarget('   '), null);
  assert.equal(parseDbTarget('not a url'), null);
  assert.equal(parseDbTarget('mysql://u@localhost/db'), null);
  assert.equal(parseDbTarget('file:./dev.db'), null);
  assert.equal(parseDbTarget('postgresql://u@localhost'), null); // DB명 없음
  assert.equal(parseDbTarget('postgresql://u@localhost/'), null);
});

test('isLoopbackHost: 127.0.0.0/8 전체와 IPv6 루프백을 인식', () => {
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('LOCALHOST'), true);
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('127.0.0.2'), true); // /8 전체가 루프백
  assert.equal(isLoopbackHost('127.255.255.254'), true);
  assert.equal(isLoopbackHost('::1'), true);
  assert.equal(isLoopbackHost('[::1]'), true);
  assert.equal(isLoopbackHost('host.docker.internal'), true);

  assert.equal(isLoopbackHost('128.0.0.1'), false);
  assert.equal(isLoopbackHost('10.0.0.1'), false);
  assert.equal(isLoopbackHost('ep-x.aws.neon.tech'), false);
});

test('isLoopbackHost: 문자열 검사였다면 통과했을 우회 사례를 막는다', () => {
  // 'localhost'를 부분 문자열로 포함하지만 원격이다.
  assert.equal(isLoopbackHost('localhost.attacker.example'), false);
  assert.equal(isLoopbackHost('not-localhost.neon.tech'), false);
  // URL 전체에는 'localhost'가 들어 있지만 host는 원격 — includes() 검사의 대표 오답.
  const sneaky = parseDbTarget('postgresql://localhost:pw@db.remote.example/appdb');
  assert.equal(sneaky?.host, 'db.remote.example');
  assert.equal(isLoopbackHost(sneaky!.host), false);
});

test('assertSeedAllowed: 루프백은 플래그 없이 허용', () => {
  const v = assertSeedAllowed(LOCAL, {});
  assert.equal(v.allowed, true);
  assert.equal(v.target?.database, 'podoal');
});

test('assertSeedAllowed: 원격은 플래그 없이 거부 — 로컬 개발은 무영향', () => {
  const v = assertSeedAllowed(NEON, {});
  assert.equal(v.allowed, false);
  assert.match(v.reason, /기본 차단/);
});

test('assertSeedAllowed: 플래그만으로는 부족 — DB명 재확인까지 일치해야 통과', () => {
  assert.equal(assertSeedAllowed(NEON, { ALLOW_DESTRUCTIVE_SEED: 'true' }).allowed, false);
  assert.equal(
    assertSeedAllowed(NEON, { ALLOW_DESTRUCTIVE_SEED: 'true', SEED_CONFIRM_DATABASE: 'podoal' }).allowed,
    false // 실제 DB명은 neondb — 다른 대상을 가리킨 채 재사용된 플래그를 잡아낸다
  );
  assert.equal(
    assertSeedAllowed(NEON, { ALLOW_DESTRUCTIVE_SEED: 'true', SEED_CONFIRM_DATABASE: 'neondb' }).allowed,
    true
  );
});

test('assertSeedAllowed: 플래그 값 규약은 정확히 "true" — 오타는 거부', () => {
  for (const bad of ['True', 'TRUE', '1', 'yes', 'on', ' true']) {
    const v = assertSeedAllowed(NEON, { ALLOW_DESTRUCTIVE_SEED: bad, SEED_CONFIRM_DATABASE: 'neondb' });
    assert.equal(v.allowed, false, `ALLOW_DESTRUCTIVE_SEED=${JSON.stringify(bad)}는 거부되어야 한다`);
  }
});

test('assertSeedAllowed: URL 자체가 없으면 거부', () => {
  const v = assertSeedAllowed(undefined, { ALLOW_DESTRUCTIVE_SEED: 'true', SEED_CONFIRM_DATABASE: 'x' });
  assert.equal(v.allowed, false);
  assert.equal(v.target, null);
});

test('assertBaselineAllowed: 루프백이어도 명시 승인을 요구한다(seed와 다른 정책)', () => {
  // baseline은 _prisma_migrations 이력을 조작하므로 로컬이라고 자동 허용하지 않는다.
  assert.equal(assertBaselineAllowed(LOCAL, {}).allowed, false);
  assert.equal(assertBaselineAllowed(LOCAL, { ALLOW_BASELINE: 'true' }).allowed, false);
  assert.equal(
    assertBaselineAllowed(LOCAL, { ALLOW_BASELINE: 'true', BASELINE_CONFIRM_DATABASE: 'podoal' }).allowed,
    true
  );
});

test('assertBaselineAllowed: seed 승인이 baseline 승인으로 번지지 않는다', () => {
  const v = assertBaselineAllowed(NEON, {
    ALLOW_DESTRUCTIVE_SEED: 'true',
    SEED_CONFIRM_DATABASE: 'neondb',
  });
  assert.equal(v.allowed, false);
});

test('describeTarget: 자격증명 없는 표기, 파싱 실패는 안내 문자열', () => {
  assert.equal(describeTarget(parseDbTarget(LOCAL)), 'localhost:55432/podoal');
  assert.equal(describeTarget(null), '(파싱 불가)');
});
