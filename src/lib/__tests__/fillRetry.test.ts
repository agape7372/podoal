import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableFillError, withFillRetry } from '../fillRetry';
import { ApiError } from '../api';

// ── 채움 POST 재시도 정책 ───────────────────────────────────────────────────
// 확정 근거(2026-07-23 재현): 배치 하나가 일시 전송 실패하면 그 배치 롤백 +
// fillResumeAt 연쇄로 뒤 배치 전부 폐기 → 완성됐던 보드가 실패 지점까지 되감김.
// 서버는 멱등(skipDuplicates)이라 같은 배치 재전송이 안전 → 일시 실패는 재시도로 회복.

test('isRetryableFillError: 4xx(결정적 클라 오류)는 재시도 안 함', () => {
  assert.equal(isRetryableFillError(new ApiError('잘못된 칸이에요', 400)), false);
  assert.equal(isRetryableFillError(new ApiError('내 포도판만', 403)), false);
  assert.equal(isRetryableFillError(new ApiError('없어요', 404)), false);
  assert.equal(isRetryableFillError(new ApiError('이미 채워진 칸', 409)), false);
  assert.equal(isRetryableFillError(new ApiError('strict', 422)), false);
});

test('isRetryableFillError: 5xx(서버 일시 오류)는 재시도', () => {
  assert.equal(isRetryableFillError(new ApiError('몰렸어요', 503)), true);
  assert.equal(isRetryableFillError(new ApiError('서버 오류', 500)), true);
});

test('isRetryableFillError: 네트워크 실패/타임아웃(ApiError 아님)은 재시도', () => {
  assert.equal(isRetryableFillError(new TypeError('Failed to fetch')), true);
  assert.equal(isRetryableFillError(new DOMException('aborted', 'AbortError')), true);
  assert.equal(isRetryableFillError('unknown'), true);
});

const noSleep = async () => {};
const rand0 = () => 0; // 백오프 결정적화

test('withFillRetry: 첫 시도 성공이면 재시도 없음', async () => {
  let calls = 0;
  const r = await withFillRetry(async () => { calls++; return 'ok'; }, {
    maxRetries: 3, baseMs: 10, sleep: noSleep, rand: rand0,
  });
  assert.equal(r, 'ok');
  assert.equal(calls, 1);
});

test('withFillRetry: 일시 실패 2번 뒤 성공 — 총 3회 호출, 백오프 2회', async () => {
  let calls = 0;
  const slept: number[] = [];
  const r = await withFillRetry(async () => {
    calls++;
    if (calls < 3) throw new TypeError('네트워크');
    return 'ok';
  }, { maxRetries: 3, baseMs: 10, sleep: async (ms) => { slept.push(ms); }, rand: rand0 });
  assert.equal(r, 'ok');
  assert.equal(calls, 3);
  // baseMs * 2**i * (0.5 + 0): i=0 → 5, i=1 → 10
  assert.deepEqual(slept, [5, 10]);
});

test('withFillRetry: maxRetries 소진하면 마지막 에러를 throw', async () => {
  let calls = 0;
  await assert.rejects(
    withFillRetry(async () => { calls++; throw new ApiError('몰렸어요', 503); }, {
      maxRetries: 2, baseMs: 10, sleep: noSleep, rand: rand0,
    }),
    (e: unknown) => e instanceof ApiError && e.status === 503,
  );
  assert.equal(calls, 3); // 최초 1 + 재시도 2
});

test('withFillRetry: 재시도 불가(4xx)면 즉시 throw — 재시도 안 함', async () => {
  let calls = 0;
  await assert.rejects(
    withFillRetry(async () => { calls++; throw new ApiError('이미 채워진 칸', 409); }, {
      maxRetries: 3, baseMs: 10, sleep: noSleep, rand: rand0,
    }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  assert.equal(calls, 1);
});
