import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRewards } from '../rewardValidation';

const ok = { type: 'letter', title: '완성 축하', content: '수고했어요', triggerAt: 10 };

test('validateRewards: 유효한 보상은 null', () => {
  assert.equal(validateRewards([ok], 10), null);
  assert.equal(validateRewards([{ ...ok, triggerAt: 5 }, { ...ok, triggerAt: 10 }], 10), null);
});

test('validateRewards: 개수 경계 (1~10)', () => {
  assert.equal(validateRewards([], 10), '보상은 1~10개여야 합니다.');
  assert.equal(validateRewards('nope', 10), '보상은 1~10개여야 합니다.');
  const eleven = Array.from({ length: 11 }, (_, i) => ({ ...ok, triggerAt: i + 1 }));
  assert.equal(validateRewards(eleven, 20), '보상은 1~10개여야 합니다.');
});

test('validateRewards: 형식 검증', () => {
  assert.equal(validateRewards([{ ...ok, type: 'invalid' }], 10), '보상 형식이 올바르지 않습니다.');
  assert.equal(validateRewards([{ ...ok, title: '' }], 10), '보상 형식이 올바르지 않습니다.');
  assert.equal(validateRewards([{ ...ok, title: 'x'.repeat(81) }], 10), '보상 형식이 올바르지 않습니다.');
  assert.equal(validateRewards([{ ...ok, content: 'x'.repeat(501) }], 10), '보상 형식이 올바르지 않습니다.');
  assert.equal(validateRewards([{ ...ok, triggerAt: '10' }], 10), '보상 형식이 올바르지 않습니다.');
});

test('validateRewards: triggerAt 범위 (1~totalStickers)', () => {
  assert.equal(validateRewards([{ ...ok, triggerAt: 0 }], 10), 'triggerAt은 1~10 사이의 정수여야 합니다.');
  assert.equal(validateRewards([{ ...ok, triggerAt: 11 }], 10), 'triggerAt은 1~10 사이의 정수여야 합니다.');
  assert.equal(validateRewards([{ ...ok, triggerAt: 5.5 }], 10), 'triggerAt은 1~10 사이의 정수여야 합니다.');
});

test('validateRewards: triggerAt 중복 금지', () => {
  assert.equal(
    validateRewards([{ ...ok, triggerAt: 5 }, { ...ok, triggerAt: 5 }], 10),
    '각 보상의 triggerAt 값은 달라야 합니다.',
  );
});

test('validateRewards: imageUrl 선택적 검증', () => {
  assert.equal(validateRewards([{ ...ok, imageUrl: 'https://x/y.png' }], 10), null);
  assert.equal(validateRewards([{ ...ok, imageUrl: 'x'.repeat(1025) }], 10), 'imageUrl이 올바르지 않습니다.');
  assert.equal(validateRewards([{ ...ok, imageUrl: 123 }], 10), 'imageUrl이 올바르지 않습니다.');
});
