'use client';

import { useState } from 'react';
import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import ClayButton from './ClayButton';
import Sparkle from './illustrations/Sparkle';
import EmojiIcon from './EmojiIcon';
import { feedbackReward } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';

interface RewardRevealProps {
  reward: RewardInfo;
  isCompleted: boolean;
  onClose?: () => void;
  initialRevealed?: boolean;
}

const SPARKLE_RING = [
  { x: 50, y: -8, color: '#CFDC78', size: 18 },
  { x: 92, y: 18, color: '#DCC4F2', size: 14 },
  { x: 100, y: 50, color: '#EFF5BB', size: 16 },
  { x: 92, y: 82, color: '#DCC4F2', size: 12 },
  { x: 50, y: 108, color: '#CFDC78', size: 18 },
  { x: 8, y: 82, color: '#EFF5BB', size: 14 },
  { x: 0, y: 50, color: '#EFF5BB', size: 16 },
  { x: 8, y: 18, color: '#EFF5BB', size: 12 },
] as const;

export default function RewardReveal({
  reward,
  isCompleted,
  onClose,
  initialRevealed = false,
}: RewardRevealProps) {
  const [isRevealed, setIsRevealed] = useState(initialRevealed);

  // Confetti now lives on the board page (one shared <Confetti>) so it can fire
  // the moment a grape is filled AND when a reward opens. This component only
  // plays the sound/haptic when opened directly (its locked-box affordance).
  const handleReveal = () => {
    if (!isCompleted) return;
    setIsRevealed(true);
    feedbackReward();
  };

  return (
    <div className="relative">
      {!isRevealed ? (
        /* Locked reward box with sparkle ring */
        <div className="relative">
          {isCompleted && (
            <div className="absolute inset-0 -m-3 pointer-events-none">
              {SPARKLE_RING.map((s, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Sparkle size={s.size} color={s.color} />
                </div>
              ))}
            </div>
          )}
          <div
            onClick={handleReveal}
            className={`
              clay-float p-8 text-center relative
              ${isCompleted ? 'cursor-pointer reward-glow' : 'opacity-75'}
              bg-gradient-to-br from-white via-clay-cream/50 to-grape-50/60
            `}
          >
            <div className="mb-4 animate-float">
              <EmojiIcon emoji={isCompleted ? '🎁' : '🔒'} size={60} className="mx-auto" />
            </div>
            <h3 className="font-display text-xl font-bold text-grape-700 mb-2">
              {isCompleted ? '보상을 확인하세요' : '보상이 숨겨져 있어요'}
            </h3>
            <p className="text-sm text-warm-sub">
              {isCompleted
                ? '터치하여 열어보세요'
                : '모든 포도알을 채우면 확인할 수 있어요'}
            </p>
            <div className="mt-3 text-sm text-grape-600 font-medium">
              {REWARD_TYPE_LABELS[reward.type]}
            </div>
          </div>
        </div>
      ) : (
        /* Revealed reward */
        <div className="clay-puffy p-6 animate-reward-reveal bg-gradient-to-br from-white via-clay-cream/40 to-grape-50/60">
          <div className="text-center">
            <div className="mb-3">
              <EmojiIcon emoji={reward.type === 'letter' ? '💌' : reward.type === 'giftcard' ? '🎁' : '⭐'} size={52} className="mx-auto" />
            </div>
            {/* The big icon above already conveys the reward type, so the label
                drops its (duplicate) leading emoji — "💌 편지" → "편지". */}
            <div className="text-xs font-medium text-grape-600 mb-2">
              {stripTitleEmoji(REWARD_TYPE_LABELS[reward.type])}
            </div>
            <h3 className="font-display text-2xl font-bold text-grape-700 mb-4">
              {reward.title}
            </h3>
            <div className="clay-sm p-5 text-left bg-white">
              <p className="text-warm-text whitespace-pre-wrap leading-relaxed">
                {reward.content}
              </p>
            </div>
            {reward.imageUrl && (
              <div className="mt-4 rounded-2xl overflow-hidden clay-sm">
                <img
                  src={reward.imageUrl}
                  alt={reward.title}
                  className="w-full object-cover max-h-60"
                />
              </div>
            )}
            {onClose && (
              <div className="mt-5">
                <ClayButton variant="secondary" onClick={onClose}>
                  닫기
                </ClayButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
