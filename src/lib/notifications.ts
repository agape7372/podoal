'use client';

import { api } from './api';
import { useAppStore } from './store';
import { writeCachedApi } from './cachedApi';
import type { NotificationEvent } from '@/types';

/** 통합 알림 피드 이벤트 중 미읽음 개수를 센다(순수 함수). */
export function countUnread(events: Array<Pick<NotificationEvent, 'read'>>): number {
  return events.filter((e) => !e.read).length;
}

// 직전 refresh 시각(모듈 변수) — visibilitychange+focus가 동시 발화하는 경우처럼
// 짧은 간격의 중복 호출이 같은 피드를 두 번 fetch하지 않도록 거른다.
// 렌더 중이 아니라 effect/이벤트 핸들러에서만 호출되므로 Date.now() 사용이 안전하다.
const REFRESH_THROTTLE_MS = 1_500;
let lastRefreshAt = 0;

/**
 * 통합 알림 피드(GET /api/notifications)를 조회해 store.unreadCount를 서버 기준값으로
 * 동기화한다 — 배지 3곳(종·네비 '더보기' 탭·더보기 '소통' 항목)의 단일 갱신 경로.
 *
 * - 직전 호출로부터 1.5초 이내의 호출은 무시(스로틀). 읽음/삭제처럼 서버 상태를 방금
 *   바꿔서 확실히 동기화해야 할 때는 `{ force: true }`로 우회한다.
 * - 피드는 최신 40개만 반환하므로 카운트는 40에 캡 — 표시가 '9+'라 실사용 영향 없음.
 * - 실패 시 기존 값을 유지한다(다음 트리거에서 재시도).
 *
 * 정합 감사: 이 함수는 카운트를 뽑으려 전체 피드를 받아놓고 그동안 버려왔다 — 알림함이
 * 마운트돼 있어도 그 화면은 이 fetch 결과를 전혀 못 봤다. writeCachedApi로 같은 캐시 키
 * ('/api/notifications')에 write-through하면 cachedApi의 키별 구독자 통지(notifyKey)가
 * 마운트된 알림함을 즉시 리페인트한다(카운트도 그 피드에서 파생 — 이중 fetch 아님).
 */
export async function refreshUnreadCount(options?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!options?.force && now - lastRefreshAt < REFRESH_THROTTLE_MS) return;
  lastRefreshAt = now;
  try {
    const data = await api<{ events: NotificationEvent[] }>('/api/notifications');
    writeCachedApi('/api/notifications', data);
    useAppStore.getState().setUnreadCount(countUnread(data.events));
  } catch {
    // 네트워크/일시 오류 — 배지는 마지막으로 알던 값을 유지한다.
  }
}
