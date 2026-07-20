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

// ─── User snapshot (2026-07-18 스켈레톤 감사) ────────────────────
// 본인 프로필 스냅샷을 localStorage에 남겨(additive 신규 키 — 기존 키 불변),
// 콜드 스타트에서 auth/me 왕복을 기다리지 않고 헤더 이름·프로필·user 게이트
// (보드 상세 capsule fetch, 채우기 탭)가 즉시 동작하게 한다. 레이아웃의 fetchUser가
// 그대로 재검증하며, 401이면 레이아웃이 스냅샷·페이지 캐시를 비우고 /로 돌려보낸다.
const USER_SNAPSHOT_KEY = 'podoal-user-snapshot-v1';

function loadUserSnapshot(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.name !== 'string' || typeof parsed.avatar !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveUserSnapshot(user: UserProfile | null): void {
  try {
    if (user) localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_SNAPSHOT_KEY);
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
  /**
   * 계정 전환 시 이전 사용자의 휘발 슬라이스 잔재를 지운다(2026-07-19 결함 수정).
   * messages/unreadCount/popupMessage/boards/friends/relays/capsules는 어떤 전환
   * 지점에서도 자동으로 비워지지 않았다 — 로그인/가입/로그아웃/탈퇴 직후 clearPageCache()
   * 옆에서 호출한다. user와 settings는 각각 별도 계약(스냅샷 write-through, 영속 설정)이라
   * 여기서 건드리지 않는다.
   */
  resetEphemeral: () => void;
}

/** user 스냅샷을 하이드레이션 이후에 주입 — (app) 레이아웃·웰컴('/')의 mount effect가
 *  호출한다. 초기 state를 스냅샷으로 직접 시드하면 서버 프리렌더 HTML(user=null,
 *  이름 스켈레톤)과 첫 렌더가 어긋나 React가 전체 루트를 recoverable 에러와 함께
 *  재렌더한다. 이미 user가 있으면(같은 세션 재호출) no-op. 반환값 = 주입/기존 user. */
export function hydrateUserSnapshot(): UserProfile | null {
  const cur = useAppStore.getState().user;
  if (cur) return cur;
  const snap = loadUserSnapshot();
  if (snap) useAppStore.setState({ user: snap });
  return snap;
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

  setUser: (user) => {
    // write-through: 스냅샷은 setUser와 항상 동행(null이면 제거) — 로그아웃/탈퇴 경로가
    // setUser(null)만 불러도 스냅샷이 남지 않게 한다.
    saveUserSnapshot(user);
    set({ user });
  },
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
  resetEphemeral: () =>
    set({
      boards: [],
      friends: [],
      messages: [],
      relays: [],
      capsules: [],
      unreadCount: 0,
      popupMessage: null,
    }),
}));
