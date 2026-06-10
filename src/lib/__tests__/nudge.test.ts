import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendNudge } from '../nudge';

// KST = UTC+9 → KST 자정 = UTC 15:00. 경계 케이스는 이 기준으로 구성한다.
const NOW = new Date('2026-06-11T03:00:00Z'); // KST 2026-06-11 12:00

test('shouldSendNudge: 설정 행이 없으면(null/undefined) 미발송 — opt-in', () => {
  assert.equal(shouldSendNudge(null, NOW), false);
  assert.equal(shouldSendNudge(undefined, NOW), false);
});

test('shouldSendNudge: dailyNudgeEnabled 꺼짐이면 미발송', () => {
  assert.equal(
    shouldSendNudge({ dailyNudgeEnabled: false, lastNudgeSentAt: null }, NOW),
    false,
  );
  // 어제 발송 이력이 있어도 꺼져 있으면 미발송
  assert.equal(
    shouldSendNudge(
      { dailyNudgeEnabled: false, lastNudgeSentAt: new Date('2026-06-10T03:00:00Z') },
      NOW,
    ),
    false,
  );
});

test('shouldSendNudge: 켜짐 + 발송 이력 없음이면 발송', () => {
  assert.equal(
    shouldSendNudge({ dailyNudgeEnabled: true, lastNudgeSentAt: null }, NOW),
    true,
  );
});

test('shouldSendNudge: 오늘(KST) 이미 발송했으면 스킵 — 크론 중복 실행 가드', () => {
  // KST 2026-06-11 09:00 발송 이력, 지금은 KST 12:00 — 같은 날
  assert.equal(
    shouldSendNudge(
      { dailyNudgeEnabled: true, lastNudgeSentAt: new Date('2026-06-11T00:00:00Z') },
      NOW,
    ),
    false,
  );
});

test('shouldSendNudge: 어제(KST) 발송했으면 오늘은 발송', () => {
  // KST 2026-06-10 12:00 발송 이력
  assert.equal(
    shouldSendNudge(
      { dailyNudgeEnabled: true, lastNudgeSentAt: new Date('2026-06-10T03:00:00Z') },
      NOW,
    ),
    true,
  );
});

test('shouldSendNudge: KST 자정 경계(UTC 15:00) — 23:59 발송 후 00:00이면 새 날', () => {
  // 발송: UTC 06-10 14:59 = KST 06-10 23:59 / 지금: UTC 06-10 15:00 = KST 06-11 00:00
  assert.equal(
    shouldSendNudge(
      { dailyNudgeEnabled: true, lastNudgeSentAt: new Date('2026-06-10T14:59:00Z') },
      new Date('2026-06-10T15:00:00Z'),
    ),
    true,
  );
});

test('shouldSendNudge: KST 자정 경계 — 00:00 발송 후 같은 날 23:59이면 스킵', () => {
  // 발송: UTC 06-10 15:00 = KST 06-11 00:00 / 지금: UTC 06-11 14:59 = KST 06-11 23:59
  assert.equal(
    shouldSendNudge(
      { dailyNudgeEnabled: true, lastNudgeSentAt: new Date('2026-06-10T15:00:00Z') },
      new Date('2026-06-11T14:59:00Z'),
    ),
    false,
  );
});
