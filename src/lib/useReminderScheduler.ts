'use client';

import { useEffect } from 'react';
import { useAppStore } from './store';
import { api } from './api';
import type { ReminderInfo, NotificationSettingInfo } from '@/types';

const CHECK_INTERVAL_MS = 60_000;
// 첫 refresh 지연 — 실행 직후 임계 fetch와의 콜드 자원 경쟁 회피. 리마인더 판정은
// 분 단위(tick 60초)라 몇 초 지연은 의미 차이가 없다.
const INITIAL_REFRESH_DELAY_MS = 4_000;
const FIRED_KEY = 'podoal-reminder-fired';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 모듈 레벨 무효화 신호 — reminders/settings는 클로저에 5분(lastFetch) 캐시되는데
// 무효화 수단이 없으면 알림 설정 페이지의 생성/수정/삭제/토글이 최대 5분간
// 스케줄러에 반영되지 않는다(구버전 리마인더로 계속 발화). 알림 설정 페이지의
// 변이 성공 지점이 이 카운터를 올리면, 다음 refresh가 TTL을 무시하고 강제 재조회한다.
let cacheEpoch = 0;
export function invalidateReminderCache() {
  cacheEpoch += 1;
}

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
  // user 객체가 아닌 id 구독 — 동일 사용자 객체 교체로 인한 reminders/settings 중복 페치 방지.
  const userId = useAppStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    let cancelled = false;
    let reminders: ReminderInfo[] = [];
    let settings: NotificationSettingInfo | null = null;
    let lastFetch = 0;
    // 이 effect 인스턴스가 마지막으로 관측한 epoch — invalidateReminderCache()가
    // 이후 올렸다면 아래 refresh에서 TTL을 무시하고 강제 재조회한다.
    let lastEpoch = cacheEpoch;

    async function refresh() {
      // 알림 권한이 없으면 fetch 자체를 건너뛴다 — tick()이 어차피 권한 없이는
      // 아무것도 발사하지 못하는데 reminders+settings 2건을 매번 받아오던 낭비
      // (권한을 나중에 허용하면 다음 60초 tick의 refresh가 자연히 받아온다).
      if (Notification.permission !== 'granted') return;
      const now = Date.now();
      // 알림 설정 페이지의 리마인더/설정 변이가 캐시를 무효화했다면 5분 TTL을
      // 무시하고 즉시 재조회 — 구버전 클로저 캐시로 계속 발화하는 것을 막는다.
      if (cacheEpoch !== lastEpoch) {
        lastEpoch = cacheEpoch;
        lastFetch = 0;
      }
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

    const initialTimer = setTimeout(() => {
      refresh().then(tick);
    }, INITIAL_REFRESH_DELAY_MS);
    const id = setInterval(() => {
      refresh().then(tick);
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(id);
    };
  }, [userId]);
}
