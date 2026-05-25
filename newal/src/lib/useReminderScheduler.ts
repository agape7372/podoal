'use client';

import { useEffect } from 'react';
import { useAppStore } from './store';
import { api } from './api';
import type { ReminderInfo, NotificationSettingInfo } from '@/types';

const CHECK_INTERVAL_MS = 60_000;
const FIRED_KEY = 'podoal-reminder-fired';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

interface FiredMap {
  [reminderId: string]: string; // last "YYYY-MM-DDTHH:mm" key we fired for
}

function loadFired(): FiredMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveFired(map: FiredMap) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable
  }
}

function kstNowParts() {
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  const date = shifted.toISOString().split('T')[0];
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  // KST day-of-week using 1=Mon..7=Sun to match the schema's `days` field.
  const jsDow = shifted.getUTCDay(); // 0=Sun..6=Sat
  const dow = jsDow === 0 ? 7 : jsDow;
  return { date, hhmm: `${hh}:${mm}`, dow };
}

function inDndWindow(hhmm: string, start: string, end: string): boolean {
  // start/end are "HH:mm". DND wraps across midnight when start > end.
  const toMinutes = (s: string) => {
    const [h, m] = s.split(':').map((x) => parseInt(x, 10));
    return h * 60 + m;
  };
  const now = toMinutes(hhmm);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

// Client-side reminder scheduler. Fires browser Notifications for any active
// reminder whose time matches "now" (in KST). Only works while the tab is open
// — true server-side scheduling requires a cron + Web Push backend that isn't
// implemented yet. The notifications page surfaces this constraint.
export function useReminderScheduler() {
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    let cancelled = false;
    let reminders: ReminderInfo[] = [];
    let settings: NotificationSettingInfo | null = null;
    let lastFetch = 0;

    async function refresh() {
      const now = Date.now();
      // Re-fetch reminders every 5 minutes to pick up edits.
      if (now - lastFetch < 5 * 60_000) return;
      try {
        const [rs, ss] = await Promise.all([
          api<{ reminders: ReminderInfo[] }>('/api/notifications/reminders'),
          api<{ settings: NotificationSettingInfo }>('/api/notifications/settings'),
        ]);
        reminders = rs.reminders.filter((r) => r.isActive);
        settings = ss.settings;
        lastFetch = now;
      } catch {
        // ignore — keep previous list
      }
    }

    async function tick() {
      if (cancelled) return;
      if (document.hidden) return; // avoid background work
      if (Notification.permission !== 'granted') return;
      if (!settings || !settings.globalEnabled || !settings.reminderEnabled) {
        await refresh();
        return;
      }

      const { date, hhmm, dow } = kstNowParts();
      if (inDndWindow(hhmm, settings.dndStart, settings.dndEnd)) return;

      const fired = loadFired();
      let dirty = false;

      for (const r of reminders) {
        if (r.time !== hhmm) continue;
        const dayList = r.days.split(',').map((d) => parseInt(d, 10));
        if (!dayList.includes(dow)) continue;
        const key = `${date}T${hhmm}`;
        if (fired[r.id] === key) continue;

        try {
          new Notification('🍇 포도알 리마인더', {
            body: r.message || (r.boardTitle ? `${r.boardTitle} 시간이에요!` : '오늘의 포도알을 채워보세요!'),
            icon: '/icons/icon.svg',
            tag: `reminder-${r.id}-${key}`,
          });
          fired[r.id] = key;
          dirty = true;
        } catch {
          // notification API failed
        }
      }

      if (dirty) saveFired(fired);
    }

    refresh().then(tick);
    const id = setInterval(() => {
      refresh().then(tick);
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);
}
