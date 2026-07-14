import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccountMerge, isRealOAuth } from '../oauth';

test('decideAccountMerge: 같은 email의 기존 계정이 없으면 create', () => {
  assert.deepEqual(decideAccountMerge(null, 'google'), { action: 'create' });
});

test('decideAccountMerge: 같은 provider 태그 재로그인은 merge', () => {
  assert.deepEqual(decideAccountMerge({ provider: 'google' }, 'google'), { action: 'merge' });
  assert.deepEqual(decideAccountMerge({ provider: 'kakao_guest' }, 'kakao_guest'), { action: 'merge' });
});

test('decideAccountMerge: 비밀번호 계정(provider=null)으로의 자동 병합은 거부 — 계정 탈취 차단', () => {
  // 핵심 보안 계약: provider가 보고한(미검증일 수 있는) email이 기존 비밀번호
  // 계정과 같아도 자동 병합하지 않는다. 하지 않으면 계정 탈취 경로가 열린다.
  assert.deepEqual(decideAccountMerge({ provider: null }, 'google'), { action: 'reject', reason: 'password' });
  assert.deepEqual(decideAccountMerge({ provider: null }, 'kakao'), { action: 'reject', reason: 'password' });
  assert.deepEqual(decideAccountMerge({ provider: null }, 'naver'), { action: 'reject', reason: 'password' });
});

test('decideAccountMerge: 다른 provider가 이미 소유한 email은 거부', () => {
  assert.deepEqual(decideAccountMerge({ provider: 'kakao' }, 'google'), { action: 'reject', reason: 'kakao' });
  assert.deepEqual(decideAccountMerge({ provider: 'google' }, 'naver'), { action: 'reject', reason: 'google' });
});

test('isRealOAuth: 자격증명 유무로 게스트/실OAuth 분기 (kakao는 secret 없어도 실OAuth)', () => {
  const keys = [
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET',
    'NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET',
  ];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  try {
    // 자격증명 전무 → 전부 게스트 폴백
    assert.equal(isRealOAuth('google'), false);
    assert.equal(isRealOAuth('kakao'), false);
    assert.equal(isRealOAuth('naver'), false);

    // google/naver는 id+secret 둘 다 필요
    process.env.GOOGLE_CLIENT_ID = 'id';
    assert.equal(isRealOAuth('google'), false);
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    assert.equal(isRealOAuth('google'), true);

    // kakao는 id만으로 실OAuth (콘솔에서 secret 선택)
    process.env.KAKAO_CLIENT_ID = 'id';
    assert.equal(isRealOAuth('kakao'), true);

    process.env.NAVER_CLIENT_ID = 'id';
    assert.equal(isRealOAuth('naver'), false);
    process.env.NAVER_CLIENT_SECRET = 'secret';
    assert.equal(isRealOAuth('naver'), true);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
