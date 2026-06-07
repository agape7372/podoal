export type RewardType = 'letter' | 'giftcard' | 'wish';
export type MessageType = 'cheer' | 'celebration' | 'gift';
export type FriendStatus = 'pending' | 'accepted';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
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
}

export interface BoardDetail extends BoardSummary {
  stickers: StickerInfo[];
  rewards: RewardInfo[];
  giftMessage?: string;
  giftOpenedAt?: string | null;
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

export interface FriendInfo {
  id: string;
  user: UserProfile;
  isFavorite: boolean;
  status: FriendStatus;
  createdAt: string;
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
  status: 'pending' | 'active' | 'completed';
}

export interface RelayInfo {
  id: string;
  title: string;
  templateId: string | null;
  totalStickers: number;
  creatorId: string;
  creator: UserProfile;
  status: 'active' | 'completed';
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
