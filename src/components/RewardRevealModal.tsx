'use client';

import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import Modal from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import Confetti from './Confetti';

interface RewardRevealModalProps {
  reward: RewardInfo;
  onClose: () => void;
}

/**
 * Prominent popup for opening a reward — used both when a MID reward is reached
 * (auto, synced to the confetti beat) and when any reward chip/card is tapped.
 * Opens INSTANTLY; if `reward.content` hasn't streamed in yet it shows a shimmer
 * placeholder until the content arrives.
 */
export default function RewardRevealModal({ reward, onClose }: RewardRevealModalProps) {
  return (
    <Modal
      variant="center"
      onClose={onClose}
      label={`보상 개봉 — ${reward.title}`}
      backdropClassName="z-95 bg-black/40 backdrop-blur-xs p-6"
      overlay={<Confetti trigger={1} />}
      sheetClassName="w-full max-w-sm bg-clay-bg rounded-[28px] clay-float p-6 text-center animate-bounce-in"
    >
      <p className="text-sm text-warm-sub mb-2">보상 개봉!</p>
        <EmojiIcon emoji={REWARD_TYPE_ICON[reward.type]} size={56} className="block mx-auto mb-2" />
        <div className="text-xs font-medium text-grape-600 mb-1">{REWARD_TYPE_LABELS[reward.type]}</div>
        <h3 className="font-display text-xl font-bold text-grape-700 mb-3 wrap-break-word">{reward.title}</h3>
        {reward.content ? (
          <div className="clay-sm bg-white p-4 mb-5 text-center">
            <p className="text-sm text-warm-text whitespace-pre-wrap leading-relaxed wrap-break-word">
              {reward.content}
            </p>
          </div>
        ) : (
          <div className="clay-sm bg-white p-4 mb-5 text-center space-y-2" aria-label="내용 불러오는 중">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        )}
        {reward.imageUrl && (
          <div className="mb-5 rounded-2xl overflow-hidden clay-sm">
            <img src={reward.imageUrl} alt={reward.title} className="w-full object-cover max-h-60" />
          </div>
        )}
      <ClayButton variant="joyful" onClick={onClose} fullWidth>
        <EmojiIcon emoji={ICON.heart} size={16} className="mr-1" />확인
      </ClayButton>
    </Modal>
  );
}
