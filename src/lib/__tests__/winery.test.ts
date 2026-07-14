import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentTier, getNextTier, getBottleSize } from '../winery';

test('getCurrentTier: 티어 경계값(0/30/100/300/500/1000/2000)', () => {
  assert.equal(getCurrentTier(0).minGrapes, 0);
  assert.equal(getCurrentTier(29).minGrapes, 0);
  assert.equal(getCurrentTier(30).minGrapes, 30); // 경계 자신은 다음 티어
  assert.equal(getCurrentTier(99).minGrapes, 30);
  assert.equal(getCurrentTier(100).minGrapes, 100);
  assert.equal(getCurrentTier(299).minGrapes, 100);
  assert.equal(getCurrentTier(300).minGrapes, 300);
  assert.equal(getCurrentTier(500).minGrapes, 500);
  assert.equal(getCurrentTier(1000).minGrapes, 1000);
  assert.equal(getCurrentTier(2000).minGrapes, 2000);
  assert.equal(getCurrentTier(999999).minGrapes, 2000); // 최상위 유지
});

test('getNextTier: 최상위 티어는 다음이 없다(null)', () => {
  assert.equal(getNextTier(2000), null);
  assert.equal(getNextTier(999999), null);
  const next0 = getNextTier(0);
  assert.ok(next0);
  assert.equal(next0.minGrapes, 30);
});

test('getBottleSize: 스티커 수 경계(15/20/30)', () => {
  assert.equal(getBottleSize(0), 'piccolo');
  assert.equal(getBottleSize(14), 'piccolo');
  assert.equal(getBottleSize(15), 'standard');
  assert.equal(getBottleSize(19), 'standard');
  assert.equal(getBottleSize(20), 'magnum');
  assert.equal(getBottleSize(29), 'magnum');
  assert.equal(getBottleSize(30), 'jeroboam');
  assert.equal(getBottleSize(60), 'jeroboam');
});
