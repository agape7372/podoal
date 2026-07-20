import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fillQueues,
  fillPendingCounts,
  pendingFillCount,
  drainPromise,
  applyPendingOverlay,
} from '../fillQueue';

// 테스트 간 모듈 레벨 Map 오염 방지 — 각 테스트가 쓴 키를 스스로 지운다.
function cleanup(boardId: string) {
  fillQueues.delete(boardId);
  fillPendingCounts.delete(boardId);
}

test('pendingFillCount — 기본값 0', () => {
  assert.equal(pendingFillCount('no-such-board'), 0);
});

test('pendingFillCount — 맵에 반영된 값을 그대로 읽음', () => {
  fillPendingCounts.set('b1', 3);
  assert.equal(pendingFillCount('b1'), 3);
  cleanup('b1');
});

test('drainPromise — 없으면 undefined', () => {
  assert.equal(drainPromise('no-such-board'), undefined);
});

test('drainPromise — 맵에 반영된 Promise를 그대로 읽음', () => {
  const p = Promise.resolve();
  fillQueues.set('b1', p);
  assert.equal(drainPromise('b1'), p);
  cleanup('b1');
});

const board = (overrides: Partial<{ id: string; filledCount: number; totalStickers: number; isCompleted: boolean }> = {}) => ({
  id: 'b1',
  filledCount: 3,
  totalStickers: 10,
  isCompleted: false,
  ...overrides,
});

test('applyPendingOverlay — pending 0이면 원본과 동일 참조(no-op)', () => {
  const b = board();
  assert.equal(applyPendingOverlay(b), b);
  cleanup('b1');
});

test('applyPendingOverlay — 이미 완성된 보드는 pending이 있어도 no-op', () => {
  fillPendingCounts.set('b1', 2);
  const b = board({ isCompleted: true, filledCount: 10 });
  assert.equal(applyPendingOverlay(b), b);
  cleanup('b1');
});

test('applyPendingOverlay — pending을 filledCount 위에 더함', () => {
  fillPendingCounts.set('b1', 2);
  const next = applyPendingOverlay(board({ filledCount: 3 }));
  assert.equal(next.filledCount, 5);
  assert.equal(next.isCompleted, false);
  cleanup('b1');
});

test('applyPendingOverlay — totalStickers 상한에서 클램프', () => {
  fillPendingCounts.set('b1', 5);
  const next = applyPendingOverlay(board({ filledCount: 8, totalStickers: 10 }));
  assert.equal(next.filledCount, 10);
  cleanup('b1');
});

test('applyPendingOverlay — 클램프로 상한에 도달하면 isCompleted true', () => {
  fillPendingCounts.set('b1', 5);
  const next = applyPendingOverlay(board({ filledCount: 8, totalStickers: 10 }));
  assert.equal(next.isCompleted, true);
  cleanup('b1');
});

test('applyPendingOverlay — 입력 객체를 변형하지 않음', () => {
  fillPendingCounts.set('b1', 2);
  const b = board({ filledCount: 3 });
  const snapshot = { ...b };
  applyPendingOverlay(b);
  assert.deepEqual(b, snapshot);
  cleanup('b1');
});
