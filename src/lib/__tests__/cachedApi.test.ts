import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeCachedApi, writeCachedApi, captureWriteVersion, isWriteVersionCurrent } from '../cachedApi';

// useCachedApi 훅 자체(state/effect)는 렌더 트리 없이 테스트하기 어려우므로, 순수
// pub/sub 배선(subscribeCachedApi ↔ writeCachedApi)만 node:test로 고정한다.

test('구독 후 writeCachedApi가 리스너를 발화', () => {
  let calls = 0;
  const unsub = subscribeCachedApi('/api/a', () => {
    calls++;
  });
  writeCachedApi('/api/a', { v: 1 });
  assert.equal(calls, 1);
  unsub();
});

test('구독 해제 후에는 발화하지 않음', () => {
  let calls = 0;
  const unsub = subscribeCachedApi('/api/b', () => {
    calls++;
  });
  unsub();
  writeCachedApi('/api/b', { v: 1 });
  assert.equal(calls, 0);
});

test('키 스코프 — 다른 키에 쓰면 발화하지 않음', () => {
  let calls = 0;
  const unsub = subscribeCachedApi('/api/c', () => {
    calls++;
  });
  writeCachedApi('/api/other', { v: 1 });
  assert.equal(calls, 0);
  unsub();
});

test('같은 키의 리스너 여러 개가 모두 발화', () => {
  let a = 0;
  let b = 0;
  const unsubA = subscribeCachedApi('/api/d', () => {
    a++;
  });
  const unsubB = subscribeCachedApi('/api/d', () => {
    b++;
  });
  writeCachedApi('/api/d', { v: 1 });
  assert.equal(a, 1);
  assert.equal(b, 1);
  unsubA();
  unsubB();
});

test('notify 중 추가된 리스너는 이번 순회에 끼어들지 않음(스냅샷 순회)', () => {
  let calls = 0;
  let lateCalls = 0;
  let unsubLate: (() => void) | undefined;
  const unsub1 = subscribeCachedApi('/api/e', () => {
    calls++;
    // notify 도중 새 구독을 추가 — 스냅샷(복사본) 순회라면 이번 회차엔 안 불림.
    unsubLate = subscribeCachedApi('/api/e', () => {
      lateCalls++;
    });
  });
  writeCachedApi('/api/e', { v: 1 });
  assert.equal(calls, 1);
  assert.equal(lateCalls, 0);
  // 다음 write에는 새로 추가된 리스너도 포함된다.
  writeCachedApi('/api/e', { v: 2 });
  assert.equal(calls, 2);
  assert.equal(lateCalls, 1);
  unsub1();
  unsubLate?.();
});

// M2 회귀 고정 — 스테일 refresh가 write-through를 덮어쓰지 않는지(단조성). 실제 훅 경로
// (refresh)는 이 두 헬퍼로 캡처/판정만 하고, cache.set 여부는 컴포넌트 쪽 if문이 결정한다
// — 여기서는 그 판정 자체(캡처한 버전이 이후 write로 무효화됨)만 순수 함수로 고정한다.

test('captureWriteVersion — 아직 아무도 안 쓴 키는 0', () => {
  assert.equal(captureWriteVersion('/api/f'), 0);
});

test('isWriteVersionCurrent — write 없이 캡처한 버전은 그대로 최신', () => {
  const v = captureWriteVersion('/api/g');
  assert.equal(isWriteVersionCurrent('/api/g', v), true);
});

test('isWriteVersionCurrent — 캡처 이후 writeCachedApi가 끼어들면 그 버전은 더 이상 최신이 아님', () => {
  const v = captureWriteVersion('/api/h');
  writeCachedApi('/api/h', { v: 1 }); // 드레인 reconcile의 write-through를 흉내
  assert.equal(isWriteVersionCurrent('/api/h', v), false);
});

test('isWriteVersionCurrent — write 이후 새로 캡처한 버전은 다시 최신', () => {
  writeCachedApi('/api/i', { v: 1 });
  const v = captureWriteVersion('/api/i');
  assert.equal(isWriteVersionCurrent('/api/i', v), true);
});

test('연속된 write는 매번 버전을 올림 — 오래된 캡처는 그 사이 몇 번을 썼든 스테일', () => {
  const v = captureWriteVersion('/api/j');
  writeCachedApi('/api/j', { v: 1 });
  writeCachedApi('/api/j', { v: 2 });
  writeCachedApi('/api/j', { v: 3 });
  assert.equal(isWriteVersionCurrent('/api/j', v), false);
  assert.equal(isWriteVersionCurrent('/api/j', captureWriteVersion('/api/j')), true);
});
