'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import { refreshUnreadCount } from './notifications';
import type { MessageInfo } from '@/types';

// 서버(/api/messages/sse)는 DB 폴링 10초 · 스트림 수명 4분으로 운영된다.
// 4분마다 서버가 스트림을 정상 종료하면 EventSource가 onerror로 떨어지고,
// 아래 백오프(기본 2초, onopen 시 리셋)로 자동 재연결한다.
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;
// 첫 연결 지연 — 실행 직후 임계 fetch(페이지 데이터)와의 콜드 자원 경쟁을 피한다.
// SSE는 실시간 '추가' 채널이라 몇 초 늦게 붙어도 유실이 없다(초기 데이터는 페이지
// fetch가 책임). 백그라운드 복귀(onVisibility)는 launch가 아니므로 기존대로 즉시.
const INITIAL_CONNECT_DELAY_MS = 3_000;

export function useSSE() {
  const addMessage = useAppStore((s) => s.addMessage);
  const showPopup = useAppStore((s) => s.showPopup);
  // user 객체가 아닌 id 구독 — setUser가 같은 사용자로 객체만 갈아끼워도
  // 스트림이 teardown+재연결되지 않게 한다(4분짜리 함수 점유 이중화 방지).
  const userId = useAppStore((s) => s.user?.id);
  const realtimeEnabled = useAppStore((s) => s.settings.realtimeNotifications);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(BASE_BACKOFF_MS);

  useEffect(() => {
    if (!userId || !realtimeEnabled) return;

    let cancelled = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeConnection = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };

    const scheduleReconnect = () => {
      clearReconnect();
      const delay = backoffRef.current;
      // Exponential backoff capped at MAX_BACKOFF_MS.
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (!cancelled && !document.hidden) connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      if (document.hidden) return; // don't poll while the tab is in the background
      if (eventSourceRef.current) return;

      const es = new EventSource('/api/messages/sse');
      eventSourceRef.current = es;

      es.onopen = () => {
        backoffRef.current = BASE_BACKOFF_MS;
      };

      es.onmessage = (event) => {
        try {
          const message: MessageInfo = JSON.parse(event.data);
          addMessage(message);
          // 팝업은 설정의 '메시지 팝업' 토글이 켜져 있을 때만 — addMessage(store 반영)과
          // 배지 증가는 이 토글과 무관하게 항상 일어나야 하므로 게이트하지 않는다
          // (이 토글이 지금까지 소비자가 없던 죽은 스위치였다).
          if (useAppStore.getState().settings.showMessagePopup) {
            showPopup(message);
          }
          // 정합 감사: SSE로 도착한 메시지가 마운트된 알림함 피드에 안 보이던 결함 —
          // refreshUnreadCount가 이제 피드를 캐시에 write-through하므로(src/lib/notifications.ts),
          // 여기서 강제 호출하면 마운트된 인박스가 실시간으로 갱신된다.
          refreshUnreadCount({ force: true });
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        closeConnection();
        if (!cancelled && !document.hidden) scheduleReconnect();
      };
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearReconnect();
        closeConnection();
      } else {
        backoffRef.current = BASE_BACKOFF_MS;
        connect();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    const initialTimer = setTimeout(connect, INITIAL_CONNECT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      clearReconnect();
      closeConnection();
    };
  }, [userId, realtimeEnabled, addMessage, showPopup]);
}
