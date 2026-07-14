import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLatestGuard } from '../latestGuard';

test('createLatestGuard: 첫 요청은 즉시 최신', () => {
  const g = createLatestGuard();
  const t = g.begin();
  assert.equal(g.isLatest(t), true);
});

test('createLatestGuard: 새 요청이 시작되면 이전 토큰은 무효', () => {
  const g = createLatestGuard();
  const t1 = g.begin();
  const t2 = g.begin();
  assert.equal(g.isLatest(t1), false); // 이전 요청 — 폐기 대상
  assert.equal(g.isLatest(t2), true); // 최신 — 반영 대상
});

test('createLatestGuard: 역순 응답 — 늦게 도착한 이전 요청은 반영되지 않는다', async () => {
  // useCachedApi의 핵심 계약 재현: 같은 인스턴스에서 url A(느림) → url B(빠름)로
  // 전환됐을 때, B가 먼저 도착해 화면을 채운 뒤 A가 늦게 도착해도 A는 폐기되어야
  // 한다(이전 url 데이터가 새 화면 state를 덮어쓰는 회귀 방지).
  const g = createLatestGuard();
  const applied: string[] = [];

  async function run(label: string, delayMs: number) {
    const token = g.begin();
    await new Promise((r) => setTimeout(r, delayMs));
    if (!g.isLatest(token)) return; // stale → 폐기
    applied.push(label);
  }

  const pA = run('A', 25); // 먼저 시작, 느리게 도착
  const pB = run('B', 5); // 나중 시작, 빠르게 도착
  await Promise.all([pA, pB]);

  assert.deepEqual(applied, ['B']); // A는 늦게 와도 반영되지 않음
});

test('createLatestGuard: 순서대로 도착해도 최신만 반영', async () => {
  const g = createLatestGuard();
  const applied: string[] = [];

  async function run(label: string, delayMs: number) {
    const token = g.begin();
    await new Promise((r) => setTimeout(r, delayMs));
    if (!g.isLatest(token)) return;
    applied.push(label);
  }

  const pA = run('A', 5); // 먼저 시작, 먼저 도착 — 하지만 B가 이미 begin()으로 최신 선점
  const pB = run('B', 25); // 나중 시작, 나중 도착
  await Promise.all([pA, pB]);

  assert.deepEqual(applied, ['B']); // 시작 시점이 더 최신인 B만 반영
});

test('createLatestGuard: 인스턴스는 서로 독립', () => {
  const g1 = createLatestGuard();
  const g2 = createLatestGuard();
  const a = g1.begin();
  g2.begin();
  assert.equal(g1.isLatest(a), true); // g2의 begin은 g1에 영향 없음
});
