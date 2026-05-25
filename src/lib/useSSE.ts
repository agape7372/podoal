'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import type { MessageInfo } from '@/types';

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export function useSSE() {
  const addMessage = useAppStore((s) => s.addMessage);
  const showPopup = useAppStore((s) => s.showPopup);
  const user = useAppStore((s) => s.user);
  const realtimeEnabled = useAppStore((s) => s.settings.realtimeNotifications);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(BASE_BACKOFF_MS);

  useEffect(() => {
    if (!user || !realtimeEnabled) return;

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
          showPopup(message);
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
    connect();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearReconnect();
      closeConnection();
    };
  }, [user, realtimeEnabled, addMessage, showPopup]);
}
