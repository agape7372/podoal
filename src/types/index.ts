export type RewardType = 'letter' | 'giftcard' | 'wish';
export type MessageType = 'cheer' | 'celebration' | 'gift';
export type FriendStatus = 'pending' | 'accepted';

export interface UserProfile {
  id: string;
  name: string;
  /** Omitted from responses about *other* users (PII) — present only for the requester (auth/me, profile). */
  email?: string;
  avatar: string;
  /** null = email account; "google"/"kakao"/"naver" (+ "_guest" fallback) = OAuth. Optional: only surfaced by /api/auth/me. */
  provider?: string | null;
}

export interface BoardSummary {
  id: string;
  title: string;
  description: string;
  totalStickers: number;
  filledCount: number;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  owner: UserProfile;
  giftedTo: UserProfile | null;
  giftedFrom: UserProfile | null;
  rewardCount: number;
  /** Owner toggle: may friends plant surprise gifts here? Surfaced by board detail + friend boards. */
  allowFriendPlant?: boolean;
  /** User-defined sort order on the home list (null = fall back to createdAt). */
  order?: number | null;
  /** "Harvested" (hidden) timestamp. null = visible on the home list. */
  harvestedAt?: string | null;
  /** True when this board belongs to a 포도동(group) relay — drives the home source badge. */
  podong?: boolean;
}

export interface BoardDetail extends BoardSummary {
  stickers: StickerInfo[];
  rewards: RewardInfo[];
  giftMessage?: string;
  giftOpenedAt?: string | null;
  /** True when this board is linked to any 포도동 (both modes) — gifting is blocked. `podong` stays group-only. */
  inRelay?: boolean;
  /** 보상 심기/편집(작성자 행위) 가능 여부 — 선물 복사본·비창시자 포도동 보드는 false (서버 판정, rewardAccess.ts). */
  canManageRewards?: boolean;
  /** 뷰어 본인이 이 보드에 심은 깜짝 선물의 위치·공개 상태(W2-A, additive). 타인 것은 절대 포함되지 않는다. */
  myPlantedGifts?: { position: number; revealedAt: string | null }[];
}

export interface PlantedGiftInfo {
  id: string;
  message: string;
  emoji: string;
  plantedBy: { id: string; name: string; avatar: string };
}

export interface StickerInfo {
  id: string;
  position: number;
  filledAt: string;
  filledBy: UserProfile;
}

export interface RewardInfo {
  id: string;
  type: RewardType;
  title: string;
  content: string;
  imageUrl: string;
  triggerAt: number;
  unlockedAt: string | null;
  revealedAt: string | null;
}

/** A reward the user has already obtained, with its source board — for the 포도밭 page. */
export interface CollectedReward extends RewardInfo {
  board: { id: string; title: string; totalStickers: number };
}

export interface FriendInfo {
  id: string;
  user: UserProfile;
  isFavorite: boolean;
  status: FriendStatus;
  createdAt: string;
}

/** Relationship of a search result to the current user (drives the action button). */
export type SearchStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

/** A user surfaced by /api/friends/search. Email is intentionally NOT returned (PII). */
export interface SearchedUser {
  id: string;
  name: string;
  avatar: string;
  status: SearchStatus;
}

export interface MessageInfo {
  id: string;
  sender: UserProfile;
  content: string;
  type: MessageType;
  emoji: string;
  boardId: string | null;
  isRead: boolean;
  createdAt: string;
}

/** 홈 종(🔔)이 여는 통합 알림 피드의 한 항목. 여러 기존 소스를 집계해 만든다(별도 테이블 없음). */
export type NotificationType =
  | 'cheer' | 'celebration' | 'gift'
  | 'reward' | 'friend-request' | 'invite' | 'planted-gift';

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** 항목 아이콘(EmojiIcon으로 렌더). */
  emoji: string;
  /** 탭하면 이동할 경로. */
  url: string;
  read: boolean;
  createdAt: string;
  /** 알림을 일으킨 상대(있으면 아바타 표시). */
  actor?: { name: string; avatar: string } | null;
}

export const AVATAR_OPTIONS = [
  'grape', 'strawberry', 'orange', 'blueberry', 'cherry', 'peach', 'apple', 'watermelon'
] as const;

export const AVATAR_EMOJIS: Record<string, string> = {
  grape: '🍇',
  strawberry: '🍓',
  orange: '🍊',
  blueberry: '🫐',
  cherry: '🍒',
  peach: '🍑',
  apple: '🍎',
  watermelon: '🍉',
};

// Emoji-free names. The icon comes from `REWARD_TYPE_ICON` (src/lib/icons.ts)
// and renders through <EmojiIcon> — keeping raw emoji out of display text.
export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  letter: '편지',
  giftcard: '기프티콘',
  wish: '소원권',
};

export const CHEER_EMOJIS = ['🍇', '💜', '✨', '🎉', '💪', '🌟', '❤️', '👏', '🔥', '🥳'];

export const BOARD_SIZES = [
  { value: 10, label: '10알', description: '작은 포도송이' },
  { value: 15, label: '15알', description: '중간 포도송이' },
  { value: 20, label: '20알', description: '큰 포도송이' },
  { value: 30, label: '30알', description: '왕 포도송이' },
];

// ─── New Feature Types ────────────────────────────────

export interface TimeCapsuleInfo {
  id: string;
  boardId: string;
  userId: string;
  message: string;
  emoji: string;
  openAt: string;
  isOpened: boolean;
  createdAt: string;
}

export interface RelayParticipantInfo {
  id: string;
  userId: string;
  user: UserProfile;
  boardId: string | null;
  order: number;
  status: 'invited' | 'pending' | 'active' | 'completed';
}

export type RelayMode = 'relay' | 'group';

export interface RelayInfo {
  id: string;
  title: string;
  templateId: string | null;
  totalStickers: number;
  creatorId: string;
  creator: UserProfile;
  status: 'active' | 'completed';
  /** relay = 순차(바통), group = 병렬. 기존 데이터는 'relay'로 간주. */
  mode?: RelayMode;
  participants: RelayParticipantInfo[];
  createdAt: string;
}

export interface NotificationSettingInfo {
  globalEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  cheerEnabled: boolean;
  rewardEnabled: boolean;
  relayEnabled: boolean;
  reminderEnabled: boolean;
  dailyNudgeEnabled: boolean;
}

export interface ReminderInfo {
  id: string;
  boardId: string | null;
  boardTitle?: string;
  time: string;
  days: string;
  message: string;
  isActive: boolean;
}

export interface HabitTemplate {
  id: string;
  category: string;
  icon: string;
  name: string;
  description: string;
  suggestedSize: number;
  suggestedReward: string;
}

// WineryTier lives in `@/lib/winery` (it also carries the `color` gradient
// field). Import it from there; this duplicate was stale and unused.

export interface HeatmapData {
  date: string;
  count: number;
}

export interface EnhancedStats {
  totalBoards: number;
  completedBoards: number;
  totalStickers: number;
  recentStickers: number;
  messagesSent: number;
  messagesReceived: number;
  friendsCount: number;
  boardsGifted: number;
  boardsReceived: number;
  streak: number;
  dailyStickers: { date: string; count: number }[];
  heatmap: HeatmapData[];
  longestStreak: number;
  currentStreak: number;
  averageDaily: number;
  mostActiveDay: string;
  completionRate: number;
  monthlyTrend: { month: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
}

export interface ShareCardData {
  title: string;
  progress: number;
  filledCount: number;
  totalStickers: number;
  userName: string;
  completedAt?: string;
}
