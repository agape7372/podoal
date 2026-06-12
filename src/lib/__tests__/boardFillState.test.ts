import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOptimisticFill,
  applyFillResult,
  rollbackFill,
  mergeServerBoard,
  stripTempsForCache,
} from '../boardFillState';
import type { BoardDetail, StickerInfo, UserProfile } from '@/types';

// 2026-06-12 연타 채움 진단의 회귀 고정 — 시나리오 명칭은 진단 보고서의 가설 id를 따른다.

const user: UserProfile = { id: 'u1', name: '테스터', email: 't@t.t', avatar: 'grape' };

const sticker = (position: number, id?: string): StickerInfo => ({
  id: id ?? `srv-${position}`,
  position,
  filledAt: '2026-06-12T00:00:00.000Z',
  filledBy: user,
});

const temp = (position: number): StickerInfo => sticker(position, `temp-${position}-1`);

function board(stickers: StickerInfo[], extra?: Partial<BoardDetail>): BoardDetail {
  return {
    id: 'b1',
    title: '테스트 보드',
    description: '',
    totalStickers: 10,
    filledCount: stickers.length,
    isCompleted: false,
    completedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    owner: user,
    giftedTo: null,
    giftedFrom: null,
    rewardCount: 0,
    stickers,
    rewards: [],
    ...extra,
  };
}

test('낙관 삽입 — filledCount ≡ stickers.length 불변식 유지', () => {
  const next = applyOptimisticFill(board([sticker(0)]), temp(1));
  assert.equal(next.stickers.length, 2);
  assert.equal(next.filledCount, 2);
});

test('reconcile — temp를 서버 스티커로 교체, 카운트는 길이 유도', () => {
  const prev = applyOptimisticFill(board([sticker(0)]), temp(1));
  const next = applyFillResult(prev, 'temp-1-1', { sticker: sticker(1), isCompleted: false });
  assert.deepEqual(next.stickers.map((s) => s.id).sort(), ['srv-0', 'srv-1']);
  assert.equal(next.filledCount, 2);
});

test('reconcile — stale 병합으로 같은 position 실 스티커가 먼저 들어와도 중복 삽입 없음 (Gap 4)', () => {
  // stale GET 병합이 srv-1을 이미 들여온 뒤 늦은 reconcile이 도착한 상황
  const prev = board([sticker(0), sticker(1), temp(2)]);
  const next = applyFillResult(prev, 'temp-9-9' /* 이미 소진된 temp */, {
    sticker: sticker(1),
    isCompleted: false,
  });
  assert.equal(next.stickers.filter((s) => s.position === 1).length, 1, 'position 1은 한 개여야 함');
  assert.equal(next.filledCount, next.stickers.length);
});

test('reconcile — isCompleted는 단조: 확정된 완성을 중간 응답이 되돌리지 않음', () => {
  const prev = board([sticker(0)], { isCompleted: true });
  const next = applyFillResult(prev, 'none', { sticker: sticker(1), isCompleted: false });
  assert.equal(next.isCompleted, true);
});

test('rollback — 해당 temp만 회수', () => {
  const prev = board([sticker(0), temp(1), temp(2)]);
  const next = rollbackFill(prev, 'temp-1-1');
  assert.deepEqual(next.stickers.map((s) => s.position).sort(), [0, 2]);
  assert.equal(next.filledCount, 2);
});

test('서버 병합 — 큐 대기 temp 보존 (#66 회귀)', () => {
  const prev = board([sticker(0), temp(1), temp(2)]);
  const next = mergeServerBoard(prev, board([sticker(0)]));
  assert.deepEqual(next.stickers.map((s) => s.position).sort(), [0, 1, 2]);
  assert.equal(next.filledCount, 3);
});

test('서버 병합 — GET 스냅샷 이후 reconcile된 실 스티커도 보존 (Gap 1: stale GET 되감김)', () => {
  // GET이 DB를 읽은 뒤(0번만 존재) 1·2번이 reconcile로 확정된 상황 — temp가 아니라
  // 실 스티커다. 통째 교체하면 화면이 1/10로 되감기고 완성 연출이 오취소된다.
  const prev = board([sticker(0), sticker(1), sticker(2)]);
  const next = mergeServerBoard(prev, board([sticker(0)]));
  assert.deepEqual(next.stickers.map((s) => s.position).sort(), [0, 1, 2]);
  assert.equal(next.filledCount, 3);
});

test('서버 병합 — stale GET의 isCompleted:false가 확정 완성을 덮지 않음', () => {
  const prev = board(
    Array.from({ length: 10 }, (_, p) => sticker(p)),
    { isCompleted: true, completedAt: null },
  );
  const stale = board([sticker(0)], { isCompleted: false });
  const next = mergeServerBoard(prev, stale);
  assert.equal(next.isCompleted, true);
  assert.equal(next.filledCount, 10);
});

test('서버 병합 — 로컬 잉여가 없으면 서버 스냅샷 그대로 (최신 서버 상태 수용)', () => {
  const prev = board([sticker(0)]);
  const server = board([sticker(0), sticker(1)]);
  const next = mergeServerBoard(prev, server);
  assert.equal(next, server);
});

test('캐시 스냅샷 — temp 제외 후 길이 유도: 이중 차감 불가 (H2 회귀)', () => {
  // 예전 산식(board.filledCount - temps.length)은 reconcile이 filledCount를 서버값
  // (temp 미포함)으로 이미 덮은 상태에서 temps를 또 빼 과소 카운트를 캐시에 박제했다.
  // 6/10 보드에서 4연타 중 1개 reconcile: 서버확정 7, temp 3.
  const prev = board([...Array.from({ length: 7 }, (_, p) => sticker(p)), temp(7), temp(8), temp(9)]);
  // 옛 버그를 모사: filledCount가 길이와 어긋난 값(서버값 7)으로 들어와도
  const drifted = { ...prev, filledCount: 7 };
  const snap = stripTempsForCache(drifted);
  assert.equal(snap.filledCount, 7, '서버 확정분 7이어야 함 (옛 산식은 7-3=4)');
  assert.equal(snap.stickers.length, 7);
});

test('캐시 스냅샷 — temp가 없으면 동일 객체 반환(불필요한 캐시 churn 방지)', () => {
  const prev = board([sticker(0), sticker(1)]);
  assert.equal(stripTempsForCache(prev), prev);
});
