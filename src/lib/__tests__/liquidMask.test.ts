import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskCircle, composeBunchMask, type RectLike } from '../liquidMask';

const rect = (left: number, top: number, width: number, height: number): RectLike => ({
  left,
  top,
  width,
  height,
});

test('maskCircle: 컨테이너-로컬 중심·반지름 계산', () => {
  // 컨테이너 (100,200) 기준, 셀 (148,260) 48x48 → 중심 (72, 84), 반지름 24.5
  const out = maskCircle(rect(148, 260, 48, 48), rect(100, 200, 270, 320));
  assert.equal(out, 'radial-gradient(circle 24.5px at 72.0px 84.0px, #000 97%, transparent 100%)');
});

test('maskCircle: overflow-x 스크롤 불변성 — 두 rect가 같이 이동하면 결과 동일', () => {
  // getBoundingClientRect()는 viewport 기준 → 공통 조상이 scrollLeft/scrollTop 만큼
  // 스크롤되면 컨테이너·셀 rect가 똑같이 이동한다. 차감 기반 좌표는 그 오프셋이
  // 상쇄되어야 한다 (60알 보드 가로 스크롤 상태에서 마스크가 어긋나지 않는 근거).
  const container = rect(100, 200, 270, 320);
  const cell = rect(148, 260, 48, 48);
  const unscrolled = maskCircle(cell, container);

  for (const [dx, dy] of [
    [-120, 0], // 가로 스크롤 (scrollLeft 120)
    [0, -340], // 세로 스크롤
    [-77.5, -12.25], // 소수 픽셀 스크롤 + 양방향
  ]) {
    const scrolled = maskCircle(
      rect(cell.left + dx, cell.top + dy, cell.width, cell.height),
      rect(container.left + dx, container.top + dy, container.width, container.height),
    );
    assert.equal(scrolled, unscrolled, `오프셋 (${dx},${dy})에서 마스크가 달라짐`);
  }
});

test('composeBunchMask: 셀 순서대로 콤마 합성', () => {
  const container = rect(0, 0, 100, 100);
  const out = composeBunchMask([rect(0, 0, 40, 40), rect(50, 50, 40, 40)], container);
  assert.equal(
    out,
    'radial-gradient(circle 20.5px at 20.0px 20.0px, #000 97%, transparent 100%),' +
      'radial-gradient(circle 20.5px at 70.0px 70.0px, #000 97%, transparent 100%)',
  );
});

test('composeBunchMask: 셀이 없으면 null (레이어 생성 스킵 신호)', () => {
  assert.equal(composeBunchMask([], rect(0, 0, 100, 100)), null);
});
