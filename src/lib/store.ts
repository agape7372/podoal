'use client';

import { create } from 'zustand';
import type { UserProfile, BoardSummary, FriendInfo, MessageInfo } from '@/types';

interface AppState {
  user: UserProfile | null;
  boards: BoardSummary[];
  friends: FriendInfo[];
  messages: MessageInfo[];
  unreadCount: number;
  popupMessage: MessageInfo | null;

  setUser: (user: UserProfile | null) => void;
  setBoards: (boards: BoardSummary[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
  setMessages: (messages: MessageInfo[]) => void;
  addMessage: (message: MessageInfo) => void;
  setUnreadCount: (count: number) => void;
  showPopup: (message: MessageInfo) => void;
  hidePopup: () => void;
  toggleFavorite: (friendId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  boards: [],
  friends: [],
  messages: [],
  unreadCount: 0,
  popupMessage: null,

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
}));
