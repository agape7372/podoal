import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countUnread, refreshUnreadCount } from '../notifications';
import { useAppStore } from '../store';

// countUnread: 배지 카운트의 단일 정의 — "통합 알림 피드의 미읽음 수".

test('countUnread: read 혼합 배열에서 미읽음만 센다', () => {
  const events = [
    { read: false },
    { read: true },
    { read: false },
    { read: false },
    { read: true },
  ];
  assert.equal(countUnread(events), 3);
});

test('countUnread: 빈 배열은 0', () => {
  assert.equal(countUnread([]), 0);
});

test('countUnread: 전부 읽음이면 0', () => {
  assert.equal(countUnread([{ read: true }, { read: true }]), 0);
});

// refreshUnreadCount: 피드 fetch → countUnread → store 반영 + 1.5초 스로틀.
// 모듈 변수(lastRefreshAt)가 테스트 간 공유되므로, 순서 독립을 위해 항상
// force로 시작한 뒤 스로틀 동작을 한 테스트 안에서 연속 검증한다.

test('refreshUnreadCount: 피드를 받아 store에 반영하고, 1.5초 내 일반 호출은 fetch를 생략한다', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    new Response(
      JSON.stringify({ events: [{ read: false }, { read: true }, { read: false }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );

  await refreshUnreadCount({ force: true });
  assert.equal(useAppStore.getState().unreadCount, 2);
  assert.equal(fetchMock.mock.callCount(), 1);

  // 스로틀: 직전 refresh 직후의 일반 호출(visibilitychange+focus 동시 발화 시나리오)은 무시.
  await refreshUnreadCount();
  assert.equal(fetchMock.mock.callCount(), 1);

  // force는 스로틀을 우회한다(읽음/삭제 등 서버 반영 직후 동기화 경로).
  await refreshUnreadCount({ force: true });
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('refreshUnreadCount: fetch 실패 시 기존 값을 유지한다', async (t) => {
  useAppStore.getState().setUnreadCount(7);
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down');
  });
  await refreshUnreadCount({ force: true });
  assert.equal(useAppStore.getState().unreadCount, 7);
});

test('refreshUnreadCount: 비정상 응답(500)도 기존 값을 유지한다', async (t) => {
  useAppStore.getState().setUnreadCount(3);
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('Internal Server Error', { status: 500 }),
  );
  await refreshUnreadCount({ force: true });
  assert.equal(useAppStore.getState().unreadCount, 3);
});
