import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arrayMove,
  computeTargetIndex,
  shiftFor,
  rowFootprint,
  inferRowGap,
  edgeScrollVelocity,
  type SlotSnapshot,
} from '../reorder';

// ─── arrayMove ──────────────────────────────────────────────────────────────

test('arrayMove: 아래로 이동', () => {
  assert.deepEqual(arrayMove(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
});

test('arrayMove: 위로 이동', () => {
  assert.deepEqual(arrayMove(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
});

test('arrayMove: from===to 는 동일 순서(복사본)', () => {
  const src = ['a', 'b', 'c'];
  const out = arrayMove(src, 1, 1);
  assert.deepEqual(out, ['a', 'b', 'c']);
  assert.notEqual(out, src); // 새 배열(입력 불변)
});

test('arrayMove: 범위 밖 인덱스는 원본 순서 유지(복사본)', () => {
  assert.deepEqual(arrayMove(['a', 'b', 'c'], -1, 2), ['a', 'b', 'c']);
  assert.deepEqual(arrayMove(['a', 'b', 'c'], 0, 9), ['a', 'b', 'c']);
});

// ─── computeTargetIndex (균일 높이) ─────────────────────────────────────────
// tops 0/100/200/300/400, height 100 → centers 50/150/250/350/450

const uniform: SlotSnapshot = {
  tops: [0, 100, 200, 300, 400],
  heights: [100, 100, 100, 100, 100],
};

test('computeTargetIndex: dy=0 이면 제자리', () => {
  assert.equal(computeTargetIndex(uniform, 0, 0), 0);
  assert.equal(computeTargetIndex(uniform, 2, 0), 2);
});

test('computeTargetIndex: 아래로 한 칸은 다음 카드 중앙선을 넘을 때', () => {
  // center = 50+dy. 아래 카드(idx1) 중앙선 150을 넘으려면 dy>=100
  assert.equal(computeTargetIndex(uniform, 0, 99), 0);
  assert.equal(computeTargetIndex(uniform, 0, 100), 1); // 닿는 순간 교체(inclusive)
  assert.equal(computeTargetIndex(uniform, 0, 210), 2);
});

test('computeTargetIndex: 아래 끝에서 클램프', () => {
  assert.equal(computeTargetIndex(uniform, 0, 5000), 4);
});

test('computeTargetIndex: 위로 이동', () => {
  // source=4, center=450+dy. idx3 중앙선 350 닿으려면 dy<=-100
  assert.equal(computeTargetIndex(uniform, 4, -99), 4);
  assert.equal(computeTargetIndex(uniform, 4, -100), 3);
  assert.equal(computeTargetIndex(uniform, 4, -210), 2);
});

test('computeTargetIndex: 위 끝에서 클램프', () => {
  assert.equal(computeTargetIndex(uniform, 4, -5000), 0);
});

test('computeTargetIndex: source 범위 밖이면 그대로 반환', () => {
  assert.equal(computeTargetIndex(uniform, -1, 100), -1);
  assert.equal(computeTargetIndex(uniform, 9, 100), 9);
});

// ─── computeTargetIndex (가변 높이) ─────────────────────────────────────────
// tops 0/100/260, heights 100/160/100 → centers 50/180/310

const variable: SlotSnapshot = {
  tops: [0, 100, 260],
  heights: [100, 160, 100],
};

test('computeTargetIndex: 가변 높이 중앙선 기준', () => {
  // source0 center 50. idx1 중앙선 180 → dy>=130
  assert.equal(computeTargetIndex(variable, 0, 129), 0);
  assert.equal(computeTargetIndex(variable, 0, 130), 1);
  // idx2 중앙선 310 → dy>=260
  assert.equal(computeTargetIndex(variable, 0, 260), 2);
});

// ─── shiftFor ───────────────────────────────────────────────────────────────

test('shiftFor: 아래로 이동 시 사이 카드들은 위로(-) 비켜줌', () => {
  // source=1, target=3, footprint=112
  assert.equal(shiftFor(0, 1, 3, 112), 0);
  assert.equal(shiftFor(1, 1, 3, 112), 0); // 드래그 행 자신
  assert.equal(shiftFor(2, 1, 3, 112), -112);
  assert.equal(shiftFor(3, 1, 3, 112), -112);
  assert.equal(shiftFor(4, 1, 3, 112), 0);
});

test('shiftFor: 위로 이동 시 사이 카드들은 아래로(+) 비켜줌', () => {
  // source=3, target=1, footprint=112
  assert.equal(shiftFor(0, 3, 1, 112), 0);
  assert.equal(shiftFor(1, 3, 1, 112), 112);
  assert.equal(shiftFor(2, 3, 1, 112), 112);
  assert.equal(shiftFor(3, 3, 1, 112), 0); // 드래그 행 자신
  assert.equal(shiftFor(4, 3, 1, 112), 0);
});

test('shiftFor: target===source 면 모두 0', () => {
  for (let i = 0; i < 5; i++) assert.equal(shiftFor(i, 2, 2, 112), 0);
});

// ─── rowFootprint / inferRowGap ─────────────────────────────────────────────

test('rowFootprint: 드래그 행 높이 + 간격', () => {
  assert.equal(rowFootprint(variable, 1, 12), 172); // 160 + 12
  assert.equal(rowFootprint(uniform, 0, 12), 112);
});

test('inferRowGap: 첫 합리적 간격을 추론(space-y-3=12)', () => {
  const snap: SlotSnapshot = { tops: [0, 112, 224], heights: [100, 100, 100] };
  assert.equal(inferRowGap(snap), 12);
});

test('inferRowGap: 행 1개면 fallback', () => {
  assert.equal(inferRowGap({ tops: [0], heights: [100] }, 12), 12);
});

test('inferRowGap: 비정상 간격(겹침/과대)은 건너뛰고 fallback', () => {
  // 첫 간격 음수(겹침) → 건너뜀, 두 번째도 과대 → fallback
  const snap: SlotSnapshot = { tops: [0, 50, 9999], heights: [100, 100, 100] };
  assert.equal(inferRowGap(snap, 12), 12);
});

// ─── edgeScrollVelocity ──────────────────────────────────────────────────────
// 곡선(선형/ease-in)은 자유 — 여기선 '방향·단조·클램프·엣지존' 불변식만 검증한다.
// (구현 전 placeholder는 항상 0을 반환하므로 이 블록이 RED. 곡선을 채우면 GREEN.)

const VH = 800; // 가상 뷰포트 높이, 기본 zone=96 / maxSpeed=16

test('edgeScrollVelocity: 한가운데(엣지존 밖)는 0', () => {
  assert.equal(edgeScrollVelocity(400, VH), 0);
  assert.equal(edgeScrollVelocity(96, VH), 0);        // 위 엣지존 경계 바로 밖
  assert.equal(edgeScrollVelocity(VH - 96, VH), 0);   // 아래 엣지존 경계 바로 밖
});

test('edgeScrollVelocity: 위 엣지존은 음수(위로), 아래 엣지존은 양수(아래로)', () => {
  assert.ok(edgeScrollVelocity(10, VH) < 0);
  assert.ok(edgeScrollVelocity(VH - 10, VH) > 0);
});

test('edgeScrollVelocity: 가장자리에 가까울수록 |속도|가 (단조) 커진다', () => {
  assert.ok(Math.abs(edgeScrollVelocity(5, VH)) >= Math.abs(edgeScrollVelocity(80, VH)));
  assert.ok(Math.abs(edgeScrollVelocity(VH - 5, VH)) >= Math.abs(edgeScrollVelocity(VH - 80, VH)));
});

test('edgeScrollVelocity: maxSpeed로 클램프된다', () => {
  assert.ok(Math.abs(edgeScrollVelocity(0, VH, 96, 16)) <= 16);
  assert.ok(Math.abs(edgeScrollVelocity(VH, VH, 96, 16)) <= 16);
});

test('edgeScrollVelocity: 엣지 너머(clientY<0 또는 viewport 초과)에서도 maxSpeed를 넘지 않는다', () => {
  // 화면 위로 한참 벗어남(드래그 캡처로 clientY가 음수가 될 수 있음)
  assert.ok(Math.abs(edgeScrollVelocity(-200, VH, 96, 16)) <= 16);
  // 아래로 한참 벗어남
  assert.ok(Math.abs(edgeScrollVelocity(VH + 200, VH, 96, 16)) <= 16);
  // 실사용 경로: viewportHeight=innerHeight-NAV_INSET로 줄여 넘기는데 손가락은 하단 네비
  // 영역(줄인 높이 초과)에 닿는다 — 여기서도 속도가 maxSpeed를 넘으면 안 된다.
  assert.ok(Math.abs(edgeScrollVelocity(800, 720, 96, 16)) <= 16);
});
