import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRewardAuthorship, type RewardOriginBoard } from '../rewardAccess';

// 보상 작성자성(출처 게이트) 판정 — 선물/포도동 수신자의 잠긴 보상 선열람 차단.
// 배경: 선물·포도동 join은 보드 복사 + ownerId 이전 모델이라 "owner = 작성자"가 깨짐.

const ME = 'user-me';
const FRIEND = 'user-friend';

function board(overrides: Partial<RewardOriginBoard> = {}): RewardOriginBoard {
  return { ownerId: ME, giftedFromId: null, relayLinks: [], ...overrides };
}

test('내가 만든 일반 보드 — 작성자로서 허용', () => {
  assert.deepEqual(checkRewardAuthorship(board(), ME), { allowed: true });
});

test('남의 보드 — not-owner로 차단 (기존 owner 검증 유지)', () => {
  assert.deepEqual(checkRewardAuthorship(board(), FRIEND), {
    allowed: false,
    reason: 'not-owner',
  });
});

test('선물 복사본 — 받은 사람이 owner여도 gifted로 차단 (서프라이즈 선열람 방지)', () => {
  const gifted = board({ giftedFromId: FRIEND });
  assert.deepEqual(checkRewardAuthorship(gifted, ME), {
    allowed: false,
    reason: 'gifted',
  });
});

test('포도동 참가자 보드(창시자 아님) — relay로 차단 (창시자 보상 복사분 보호)', () => {
  const joined = board({ relayLinks: [{ relay: { creatorId: FRIEND } }] });
  assert.deepEqual(checkRewardAuthorship(joined, ME), {
    allowed: false,
    reason: 'relay',
  });
});

test('포도동 창시자의 템플릿 보드 — 본인 작성이므로 허용', () => {
  const template = board({ relayLinks: [{ relay: { creatorId: ME } }] });
  assert.deepEqual(checkRewardAuthorship(template, ME), { allowed: true });
});

test('선물 복사본이 포도동에도 연결된 경우 — gifted가 먼저 (판정 순서 고정)', () => {
  const both = board({ giftedFromId: FRIEND, relayLinks: [{ relay: { creatorId: FRIEND } }] });
  assert.deepEqual(checkRewardAuthorship(both, ME), {
    allowed: false,
    reason: 'gifted',
  });
});

test('포도동 링크가 비어 있으면 relay 게이트는 통과 (일반 보드와 동일)', () => {
  assert.deepEqual(checkRewardAuthorship(board({ relayLinks: [] }), ME), { allowed: true });
});
