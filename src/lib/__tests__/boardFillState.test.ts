import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOptimisticFill,
  applyFillResult,
  applyBatchFillResult,
  planFillBatches,
  rollbackFill,
  mergeServerBoard,
  stripTempsForCache,
  FILL_BATCH_MAX,
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
  const next = rollbackFill(prev, 'temp-1-1', 1);
  assert.deepEqual(next.stickers.map((s) => s.position).sort(), [0, 2]);
  assert.equal(next.filledCount, 2);
});

test('rollback — 같은 position의 재주입(reseed) temp도 함께 회수 (좀비 롤백 vs 재진입 temp)', () => {
  // 좀비 항목(temp-2-zombie) 실패 시점에 재진입 인스턴스가 같은 칸을
  // temp-2-reseed로 재주입한 상태 — id가 달라도 position 매칭으로 유령이 안 남는다.
  const prev = board([sticker(0), sticker(2, 'temp-2-reseed')]);
  const next = rollbackFill(prev, 'temp-2-zombie', 2);
  assert.deepEqual(next.stickers.map((s) => s.position), [0]);
  assert.equal(next.filledCount, 1);
});

test('rollback — 같은 position의 실 스티커는 보존 (409 후 재동기화 병합분 보호)', () => {
  // 내 temp가 409로 롤백될 때, resync가 먼저 병합한 서버 확정 스티커(srv-1)는
  // 같은 position이어도 지우면 안 된다.
  const prev = board([sticker(0), sticker(1), temp(1)]);
  const next = rollbackFill(prev, 'temp-1-1', 1);
  assert.deepEqual(next.stickers.map((s) => s.id), ['srv-0', 'srv-1']);
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

test('서버 병합 — 보드 id가 다르면 병합하지 않고 서버 스냅샷 채택 (교차 보드 오염 방지)', () => {
  const prevA = board([sticker(0), temp(1)], { id: 'board-A' } as Partial<BoardDetail>);
  const serverB = board([sticker(0)], { id: 'board-B' } as Partial<BoardDetail>);
  const next = mergeServerBoard(prevA, serverB);
  assert.equal(next, serverB);
  assert.equal(next.stickers.length, 1, 'A의 temp가 B에 보존되면 안 됨');
});

test('서버 병합 — completedAt도 단조: stale GET의 null이 확정값을 덮지 않음', () => {
  const prev = board(
    Array.from({ length: 10 }, (_, p) => sticker(p)),
    { isCompleted: true, completedAt: '2026-06-12T12:00:00.000Z' },
  );
  const stale = board([sticker(0)], { isCompleted: false, completedAt: null });
  const next = mergeServerBoard(prev, stale);
  assert.equal(next.completedAt, '2026-06-12T12:00:00.000Z');
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

// ─── planFillBatches — 배치 코얼레싱 세그먼트 플래너 ─────────────────────────

test('planFillBatches — 경계 없음: 전체가 한 세그먼트', () => {
  assert.deepEqual(planFillBatches([0, 1, 2], [], 0, 10), [[0, 1, 2]]);
});

test('planFillBatches — 빈 입력은 빈 결과', () => {
  assert.deepEqual(planFillBatches([], [3], 0, 10), []);
});

test('planFillBatches — 보상 임계에서 분할(임계 칸 포함까지가 앞 세그먼트)', () => {
  // triggerAt=3: 누적 카운트 3에 도달하는 position 2 뒤에서 끊는다 →
  // 앞 배치의 응답에만 그 보상이 실린다(응답당 보상 ≤1).
  assert.deepEqual(planFillBatches([0, 1, 2, 3, 4], [3], 0, 10), [[0, 1, 2], [3, 4]]);
});

test('planFillBatches — 임계 여러 개를 가로지르면 각각에서 분할', () => {
  assert.deepEqual(
    planFillBatches([0, 1, 2, 3, 4, 5], [2, 4], 0, 10),
    [[0, 1], [2, 3], [4, 5]],
  );
});

test('planFillBatches — serverFilledCount 오프셋: 누적 = 확정 + 배치 소비분', () => {
  // 5칸 확정 후 [5,6,7] 버퍼, triggerAt=7 → position 6에서 누적 7 도달.
  assert.deepEqual(planFillBatches([5, 6, 7], [7], 5, 20), [[5, 6], [7]]);
});

test('planFillBatches — 이미 지난 임계(≤ serverFilledCount)는 분할하지 않음', () => {
  assert.deepEqual(planFillBatches([5, 6], [3], 5, 20), [[5, 6]]);
});

test('planFillBatches — 완성 칸(누적 == totalStickers)도 세그먼트 경계', () => {
  // triggerAt=9가 먼저 끊고, 완성 칸(누적 10)은 자기 세그먼트로 격리된다.
  assert.deepEqual(planFillBatches([8, 9], [9], 8, 10), [[8], [9]]);
});

test('planFillBatches — 완성 임계(triggerAt == totalStickers)는 완성 경계와 합쳐 한 세그먼트', () => {
  assert.deepEqual(planFillBatches([8, 9], [10], 8, 10), [[8, 9]]);
});

test('planFillBatches — 길이 캡(FILL_BATCH_MAX)에서 분할', () => {
  const positions = Array.from({ length: FILL_BATCH_MAX + 5 }, (_, i) => i);
  const segments = planFillBatches(positions, [], 0, 100);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].length, FILL_BATCH_MAX);
  assert.equal(segments[1].length, 5);
  assert.deepEqual(segments.flat(), positions, '분할해도 순서·전체 집합 보존');
});

// ─── applyBatchFillResult — 배치 reconcile fold ──────────────────────────────

test('배치 reconcile — temp들을 서버 스티커로 교체, filledCount ≡ stickers.length 불변식', () => {
  const prev = board([sticker(0), temp(1), temp(2)]);
  const next = applyBatchFillResult(
    prev,
    [{ tempId: 'temp-1-1', position: 1 }, { tempId: 'temp-2-1', position: 2 }],
    { stickers: [sticker(1), sticker(2)], isCompleted: false },
  );
  assert.deepEqual(next.stickers.map((s) => s.id).sort(), ['srv-0', 'srv-1', 'srv-2']);
  assert.equal(next.filledCount, 3);
  assert.equal(next.filledCount, next.stickers.length);
});

test('배치 reconcile — temp가 없는 기확정 position의 스티커도 중복 없이 흡수', () => {
  // 서버는 요청 칸 "전체"를 돌려준다 — stale 병합으로 이미 실 스티커가 있는 칸의
  // 응답 스티커는 교체(중복 삽입 없음), temp 매칭이 없어도 안전해야 한다.
  const prev = board([sticker(0), sticker(1), temp(2)]);
  const next = applyBatchFillResult(
    prev,
    [{ tempId: 'temp-2-1', position: 2 }], // position 1은 이 배치의 temp가 아니다
    { stickers: [sticker(1, 'srv-1b'), sticker(2)], isCompleted: false },
  );
  assert.equal(next.stickers.filter((s) => s.position === 1).length, 1, 'position 1은 한 개');
  assert.equal(next.stickers.length, 3);
  assert.equal(next.filledCount, 3);
});

test('배치 reconcile — 재주입(reseed) temp도 position 매칭으로 교체된다', () => {
  // 좀비 버퍼의 원 tempId와 재진입 인스턴스의 reseed temp id가 달라도 유령이 안 남는다.
  const prev = board([sticker(0), sticker(1, 'temp-1-reseed')]);
  const next = applyBatchFillResult(
    prev,
    [{ tempId: 'temp-1-zombie', position: 1 }],
    { stickers: [sticker(1)], isCompleted: false },
  );
  assert.deepEqual(next.stickers.map((s) => s.id).sort(), ['srv-0', 'srv-1']);
  assert.equal(next.filledCount, 2);
});

test('배치 reconcile — isCompleted 단조 + completedAt write-through', () => {
  // 완성 배치: 응답의 completedAt이 로컬에 들어온다(단건 POST엔 없던 additive win).
  const prev = board([temp(0), temp(1)], { totalStickers: 2 } as Partial<BoardDetail>);
  const next = applyBatchFillResult(
    prev,
    [{ tempId: 'temp-0-1', position: 0 }, { tempId: 'temp-1-1', position: 1 }],
    { stickers: [sticker(0), sticker(1)], isCompleted: true, completedAt: '2026-07-20T00:00:00.000Z' },
  );
  assert.equal(next.isCompleted, true);
  assert.equal(next.completedAt, '2026-07-20T00:00:00.000Z');

  // 단조: 이미 완성 확정된 로컬을 늦은 응답의 false가 되돌리지 않는다.
  const completed = board([sticker(0)], { isCompleted: true, completedAt: '2026-07-19T00:00:00.000Z' });
  const after = applyBatchFillResult(completed, [], { stickers: [], isCompleted: false, completedAt: null });
  assert.equal(after.isCompleted, true);
  assert.equal(after.completedAt, '2026-07-19T00:00:00.000Z', '기존 completedAt 보존');
});
