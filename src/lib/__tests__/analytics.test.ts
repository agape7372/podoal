import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYTICS_EVENTS,
  parseConsent,
  shouldTrackWith,
  markFirstDone,
  trackFirst,
} from '../analytics';

// ── 사전 드리프트 가드 — ANALYTICS_PLAN §2 사전(19종) + grape_fill_failed(§3-4)만 허용.
// 이벤트 추가는 문서 개정 → 이 목록 갱신 순서로만(임의 추가 시 여기서 깨진다).
test('ANALYTICS_EVENTS: 사전과 정확히 일치', () => {
  const canonical = [
    'install_banner_shown',
    'install_banner_accepted',
    'signup_completed',
    'login_completed',
    'first_board_created',
    'first_fill',
    'board_created',
    'grape_filled',
    'board_completed',
    'board_harvested',
    'reward_unlocked',
    'reward_revealed',
    'friend_accepted',
    'cheer_sent',
    'gift_sent',
    'relay_started',
    'push_subscribed',
    'cadence_selected',
    'fill_early_override',
    'fill_backfill',
    'grape_fill_failed',
  ];
  assert.deepEqual([...ANALYTICS_EVENTS], canonical);
});

// ── 동의값 파싱 — 오염값은 전부 unset(배너 재노출이 안전한 기본값)
test('parseConsent: 정상값과 오염값', () => {
  assert.equal(parseConsent('granted'), 'granted');
  assert.equal(parseConsent('denied'), 'denied');
  assert.equal(parseConsent(null), 'unset');
  assert.equal(parseConsent(''), 'unset');
  assert.equal(parseConsent('true'), 'unset');
  assert.equal(parseConsent('GRANTED'), 'unset');
  assert.equal(parseConsent('{"granted":true}'), 'unset');
});

// ── no-op 게이트 진리표 — 서버사이드/키 없음/비동의 어느 하나라도 걸리면 false
test('shouldTrackWith: 진리표', () => {
  assert.equal(shouldTrackWith({ isClient: true, hasKey: true, consent: 'granted' }), true);
  assert.equal(shouldTrackWith({ isClient: false, hasKey: true, consent: 'granted' }), false);
  assert.equal(shouldTrackWith({ isClient: true, hasKey: false, consent: 'granted' }), false);
  assert.equal(shouldTrackWith({ isClient: true, hasKey: true, consent: 'denied' }), false);
  assert.equal(shouldTrackWith({ isClient: true, hasKey: true, consent: 'unset' }), false);
});

// ── first_* 1회성 — 주입 스토어(Map)로 localStorage 없이 검증
function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

test('markFirstDone: 플래그만 세팅, 멱등', () => {
  const store = memStore();
  markFirstDone('u1', 'board', store);
  markFirstDone('u1', 'board', store);
  assert.deepEqual(JSON.parse(store.getItem('podoal-analytics-first:u1')!), { board: true });
  // 같은 유저의 다른 종류는 병합
  markFirstDone('u1', 'fill', store);
  assert.deepEqual(JSON.parse(store.getItem('podoal-analytics-first:u1')!), { board: true, fill: true });
});

test('trackFirst: 이미 플래그가 있으면 재발화 없이 no-op', () => {
  const store = memStore();
  // 비관적 시딩(기존 유저) 후 trackFirst — 플래그 유지, (track은 node 환경이라 어차피 no-op이지만
  // 플래그 로직 자체가 두 번째 호출을 걸러내는지를 본다)
  markFirstDone('u2', 'fill', store);
  trackFirst('u2', 'fill', 'first_fill', undefined, store);
  assert.deepEqual(JSON.parse(store.getItem('podoal-analytics-first:u2')!), { fill: true });
  // 새 유저는 첫 호출에서 플래그가 생긴다
  trackFirst('u3', 'board', 'first_board_created', { size: 10 }, store);
  assert.deepEqual(JSON.parse(store.getItem('podoal-analytics-first:u3')!), { board: true });
});

test('유저별 플래그 격리', () => {
  const store = memStore();
  markFirstDone('a', 'board', store);
  assert.equal(store.getItem('podoal-analytics-first:b'), null);
});
