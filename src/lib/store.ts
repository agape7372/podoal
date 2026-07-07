'use client';

import { create } from 'zustand';
import type { UserProfile, BoardSummary, FriendInfo, MessageInfo, RelayInfo, TimeCapsuleInfo } from '@/types';

// ─── Settings ──────────────────────────────────────────────

export interface AppSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  soundVolume: number;
  fillSoundId: number;
  showMessagePopup: boolean;
  realtimeNotifications: boolean;
  /** 홈 "친구 소식" 피드 숨김(ABS-14 심리 안전). 기본 false = 표시. */
  hideFriendFeed: boolean;
}

const SETTINGS_STORAGE_KEY = 'podoal-app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  hapticEnabled: true,
  soundVolume: 0.5,
  fillSoundId: 13,
  showMessagePopup: true,
  realtimeNotifications: true,
  hideFriendFeed: false,
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Store ─────────────────────────────────────────────────

interface AppState {
  user: UserProfile | null;
  boards: BoardSummary[];
  friends: FriendInfo[];
  messages: MessageInfo[];
  relays: RelayInfo[];
  capsules: TimeCapsuleInfo[];
  /**
   * 통합 알림 피드(GET /api/notifications) 기준 미읽음 수 — 단일 계약.
   * 종 배지·네비 '더보기' 탭·더보기 '소통' 항목이 전부 이 값 하나를 읽는다.
   * 갱신은 src/lib/notifications.ts의 refreshUnreadCount()로 수렴시킨다
   * (메시지만의 로컬 계산으로 덮어쓰지 말 것).
   */
  unreadCount: number;
  popupMessage: MessageInfo | null;
  settings: AppSettings;

  setUser: (user: UserProfile | null) => void;
  setBoards: (boards: BoardSummary[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
  setMessages: (messages: MessageInfo[]) => void;
  addMessage: (message: MessageInfo) => void;
  setRelays: (relays: RelayInfo[]) => void;
  setCapsules: (capsules: TimeCapsuleInfo[]) => void;
  setUnreadCount: (count: number) => void;
  showPopup: (message: MessageInfo) => void;
  hidePopup: () => void;
  toggleFavorite: (friendId: string) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  boards: [],
  friends: [],
  messages: [],
  relays: [],
  capsules: [],
  unreadCount: 0,
  popupMessage: null,
  settings: loadSettings(),

  setUser: (user) => set({ user }),
  setBoards: (boards) => set({ boards }),
  setFriends: (friends) => set({ friends }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages],
      // 낙관적 증가: SSE로 새 메시지를 받은 즉시 배지를 올리고,
      // 다음 refreshUnreadCount()에서 서버값(/api/notifications)으로 수렴한다.
      unreadCount: state.unreadCount + 1,
    })),
  setRelays: (relays) => set({ relays }),
  setCapsules: (capsules) => set({ capsules }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  showPopup: (message) => set({ popupMessage: message }),
  hidePopup: () => set({ popupMessage: null }),
  toggleFavorite: (friendId) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        f.id === friendId ? { ...f, isFavorite: !f.isFavorite } : f
      ),
    })),
  updateSettings: (partial) =>
    set((state) => {
      const updated = { ...state.settings, ...partial };
      saveSettings(updated);
      return { settings: updated };
    }),
}));
