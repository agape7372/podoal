import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCronAuth } from '../cronAuth';

function reqWithAuth(auth?: string): Request {
  const headers = new Headers();
  if (auth !== undefined) headers.set('authorization', auth);
  return new Request('http://podoal.local/api/cron/reminders', { headers });
}

function withCronSecret<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
}

test('verifyCronAuth: CRON_SECRET 미설정이면 무조건 false (방어적)', () => {
  withCronSecret(undefined, () => {
    assert.equal(verifyCronAuth(reqWithAuth('Bearer anything')), false);
    assert.equal(verifyCronAuth(reqWithAuth()), false);
  });
});

test('verifyCronAuth: 정확히 일치할 때만 true', () => {
  withCronSecret('s3cr3t-token-value', () => {
    assert.equal(verifyCronAuth(reqWithAuth('Bearer s3cr3t-token-value')), true);
    assert.equal(verifyCronAuth(reqWithAuth('Bearer wrong-token')), false);
    assert.equal(verifyCronAuth(reqWithAuth('s3cr3t-token-value')), false); // Bearer 스킴 누락
    assert.equal(verifyCronAuth(reqWithAuth('Bearer S3CR3T-TOKEN-VALUE')), false); // 대소문자 구분
    assert.equal(verifyCronAuth(reqWithAuth()), false); // 헤더 없음
  });
});

test('verifyCronAuth: 길이가 크게 다른 토큰도 throw 없이 false (sha256 고정길이 비교)', () => {
  withCronSecret('short', () => {
    // timingSafeEqual은 길이 불일치 시 throw하지만, sha256으로 32B 고정 후
    // 비교하므로 매우 긴 위조 토큰도 예외 없이 false여야 한다.
    assert.equal(verifyCronAuth(reqWithAuth('Bearer ' + 'x'.repeat(4096))), false);
    assert.equal(verifyCronAuth(reqWithAuth('Bearer ')), false);
  });
});
