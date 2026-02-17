'use client';

import { create } from 'zustand';
import type { UserProfile, BoardSummary, FriendInfo, MessageInfo } from '@/types';

// ─── Settings ──────────────────────────────────────────────

export interface AppSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  soundVolume: number;
  fillSoundId: number;
  showMessagePopup: boolean;
  realtimeNotifications: boolean;
}

const SETTINGS_STORAGE_KEY = 'podoal-app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  hapticEnabled: true,
  soundVolume: 0.5,
  fillSoundId: 13,
  showMessagePopup: true,
  realtimeNotifications: true,
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
  unreadCount: number;
  popupMessage: MessageInfo | null;
  settings: AppSettings;

  setUser: (user: UserProfile | null) => void;
  setBoards: (boards: BoardSummary[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
  setMessages: (messages: MessageInfo[]) => void;
  addMessage: (message: MessageInfo) => void;
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
      unreadCount: state.unreadCount + 1,
    })),
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
