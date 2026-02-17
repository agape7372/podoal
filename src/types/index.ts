export type RewardType = 'letter' | 'giftcard' | 'wish';
export type MessageType = 'cheer' | 'celebration' | 'gift';
export type FriendStatus = 'pending' | 'accepted';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
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
  hasReward: boolean;
}

export interface BoardDetail extends BoardSummary {
  stickers: StickerInfo[];
  reward: RewardInfo | null;
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

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  letter: '💌 편지',
  giftcard: '🎁 기프티콘',
  wish: '⭐ 소원권',
};

export const CHEER_EMOJIS = ['🍇', '💜', '✨', '🎉', '💪', '🌟', '❤️', '👏', '🔥', '🥳'];

export const BOARD_SIZES = [
  { value: 10, label: '10알', description: '작은 포도송이' },
  { value: 15, label: '15알', description: '중간 포도송이' },
  { value: 20, label: '20알', description: '큰 포도송이' },
  { value: 30, label: '30알', description: '왕 포도송이' },
];
