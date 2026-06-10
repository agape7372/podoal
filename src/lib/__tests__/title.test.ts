import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTitleEmoji } from '../title';

test('stripTitleEmoji: 선두 이모지 + 공백 제거', () => {
  assert.equal(stripTitleEmoji('💧 물 마시기'), '물 마시기');
  assert.equal(stripTitleEmoji('🏃‍♂️ 달리기'), '달리기'); // ZWJ 시퀀스
  assert.equal(stripTitleEmoji('🍇🍷 와인'), '와인'); // 연속 이모지
});

test('stripTitleEmoji: 이모지 없는 제목은 그대로', () => {
  assert.equal(stripTitleEmoji('물 마시기'), '물 마시기');
  assert.equal(stripTitleEmoji('운동하기'), '운동하기');
});

test('stripTitleEmoji: 제목이 이모지뿐이면 원본 보존(빈 문자열 방지)', () => {
  assert.equal(stripTitleEmoji('💧'), '💧');
  assert.equal(stripTitleEmoji('🍇🍷'), '🍇🍷');
});

test('stripTitleEmoji: 선두가 그림문자가 아닌 키캡 숫자(1️⃣)는 보존(정규식 범위 밖 — 현 동작)', () => {
  // 키캡은 ASCII 숫자로 시작해 Extended_Pictographic가 아니므로 선두 매칭에서 제외된다.
  assert.equal(stripTitleEmoji('1️⃣ 첫 단계'), '1️⃣ 첫 단계');
});

test('stripTitleEmoji: 중간/끝 이모지는 보존(선두만 제거)', () => {
  assert.equal(stripTitleEmoji('물 💧 마시기'), '물 💧 마시기');
  assert.equal(stripTitleEmoji('달리기 🏃'), '달리기 🏃');
});

test('stripTitleEmoji: falsy 입력 안전 처리', () => {
  assert.equal(stripTitleEmoji(''), '');
});
