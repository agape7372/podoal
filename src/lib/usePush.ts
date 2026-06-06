'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || navStandalone;
}

export interface PushState {
  supported: boolean;
  reason: string; // why unsupported (shown in UI)
  permission: NotificationPermission;
  subscribed: boolean;
  busy: boolean;
}

const DEFAULT: PushState = {
  supported: false,
  reason: '',
  permission: 'default',
  subscribed: false,
  busy: false,
};

export function usePush() {
  const [state, setState] = useState<PushState>(DEFAULT);

  useEffect(() => {
    let active = true;
    (async () => {
      const hasApi =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      if (!hasApi) {
        // iOS exposes Web Push only inside an installed PWA (iOS 16.4+).
        const reason =
          isIos() && !isStandalone()
            ? '홈 화면에 추가한 뒤(공유 → 홈 화면에 추가) 켤 수 있어요.'
            : '이 브라우저는 푸시 알림을 지원하지 않아요.';
        if (active) setState((s) => ({ ...s, supported: false, reason }));
        return;
      }
      if (!VAPID) {
        if (active) setState((s) => ({ ...s, supported: false, reason: '서버에 푸시 키가 아직 설정되지 않았어요.' }));
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) {
          setState({ supported: true, reason: '', permission: Notification.permission, subscribed: !!sub, busy: false });
        }
      } catch {
        if (active) setState((s) => ({ ...s, supported: true, reason: '', permission: Notification.permission }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState((s) => ({ ...s, permission: perm, busy: false }));
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
      });
      const json = sub.toJSON();
      await api('/api/push/subscribe', { method: 'POST', json: { endpoint: json.endpoint, keys: json.keys } });
      setState((s) => ({ ...s, permission: 'granted', subscribed: true, busy: false }));
      return true;
    } catch {
      setState((s) => ({ ...s, busy: false }));
      return false;
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('/api/push/subscribe', { method: 'DELETE', json: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState((s) => ({ ...s, subscribed: false, busy: false }));
      return true;
    } catch {
      setState((s) => ({ ...s, busy: false }));
      return false;
    }
  }, []);

  return { ...state, enable, disable };
}
