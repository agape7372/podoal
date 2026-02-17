'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import type { MessageInfo } from '@/types';

export function useSSE() {
  const addMessage = useAppStore((s) => s.addMessage);
  const showPopup = useAppStore((s) => s.showPopup);
  const user = useAppStore((s) => s.user);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user) return;

    const connect = () => {
      const es = new EventSource('/api/messages/sse');
      eventSourceRef.current = es;

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
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [user, addMessage, showPopup]);
}
