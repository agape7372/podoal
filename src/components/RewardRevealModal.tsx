'use client';

import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import Confetti from './Confetti';

interface RewardRevealModalProps {
  reward: RewardInfo;
  onClose: () => void;
}

/**
 * Prominent popup that opens the instant a MID reward is reached — the "쾌감"
 * beat. The reward also stays in the board's reward list as a record (compact
 * RewardReveal). The final/completion reward does NOT use this (kept as the
 * tap-to-open card), per product intent.
 */
export default function RewardRevealModal({ reward, onClose }: RewardRevealModalProps) {
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Confetti trigger={1} />
      <div className="w-full max-w-sm bg-clay-bg rounded-[28px] clay-float p-6 text-center animate-bounce-in">
        <p className="text-sm text-warm-sub mb-2">포도알 속 중간 보상!</p>
        <EmojiIcon emoji={REWARD_TYPE_ICON[reward.type]} size={56} className="block mx-auto mb-2" />
        <div className="text-xs font-medium text-grape-600 mb-1">{REWARD_TYPE_LABELS[reward.type]}</div>
        <h3 className="font-display text-xl font-bold text-grape-700 mb-3 break-words">{reward.title}</h3>
        <div className="clay-sm bg-white p-4 mb-5 text-left">
          <p className="text-sm text-warm-text whitespace-pre-wrap leading-relaxed break-words">
            {reward.content}
          </p>
        </div>
        {reward.imageUrl && (
          <div className="mb-5 rounded-2xl overflow-hidden clay-sm">
            <img src={reward.imageUrl} alt={reward.title} className="w-full object-cover max-h-60" />
          </div>
        )}
        <ClayButton variant="joyful" onClick={onClose} fullWidth>
          <EmojiIcon emoji={ICON.heart} size={16} className="mr-1" />확인
        </ClayButton>
      </div>
    </div>
  );
}
