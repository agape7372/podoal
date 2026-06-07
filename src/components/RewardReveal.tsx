'use client';

import { useState } from 'react';
import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import ClayButton from './ClayButton';
import Sparkle from './illustrations/Sparkle';
import EmojiIcon from './EmojiIcon';
import { feedbackReward } from '@/lib/feedback';

interface RewardRevealProps {
  reward: RewardInfo;
  isCompleted: boolean;
  onClose?: () => void;
  initialRevealed?: boolean;
}

const SPARKLE_RING = [
  { x: 50, y: -8, color: '#CFDC78', size: 16 },
  { x: 92, y: 18, color: '#DCC4F2', size: 12 },
  { x: 100, y: 50, color: '#EFF5BB', size: 14 },
  { x: 92, y: 82, color: '#DCC4F2', size: 10 },
  { x: 50, y: 108, color: '#CFDC78', size: 16 },
  { x: 8, y: 82, color: '#EFF5BB', size: 12 },
  { x: 0, y: 50, color: '#EFF5BB', size: 14 },
  { x: 8, y: 18, color: '#EFF5BB', size: 10 },
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
              clay-float p-5 text-center relative
              ${isCompleted ? 'cursor-pointer reward-glow' : 'opacity-75'}
              bg-gradient-to-br from-white via-clay-cream/50 to-grape-50/60
            `}
          >
            <div className="mb-2 animate-float">
              <EmojiIcon emoji={isCompleted ? ICON.gift : ICON.lock} size={40} className="mx-auto" />
            </div>
            <h3 className="font-display text-lg font-bold text-grape-700 mb-1">
              {isCompleted ? '보상을 확인하세요' : '보상이 숨겨져 있어요'}
            </h3>
            <p className="text-xs text-warm-sub">
              {isCompleted ? '터치하여 열어보세요' : '모든 포도알을 채우면 확인할 수 있어요'}
            </p>
            <div className="mt-2 text-xs text-grape-600 font-medium inline-flex items-center gap-1">
              <EmojiIcon emoji={REWARD_TYPE_ICON[reward.type]} size={14} />
              {REWARD_TYPE_LABELS[reward.type]}
            </div>
          </div>
        </div>
      ) : (
        /* Revealed reward — compact record card */
        <div className="clay-sm p-4 animate-reward-reveal bg-gradient-to-br from-white via-clay-cream/40 to-grape-50/60">
          <div className="flex items-start gap-3">
            <EmojiIcon emoji={REWARD_TYPE_ICON[reward.type]} size={32} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-grape-600 mb-0.5">
                {REWARD_TYPE_LABELS[reward.type]}
              </div>
              <h3 className="font-display text-lg font-bold text-grape-700 mb-2 break-words">
                {reward.title}
              </h3>
              <div className="clay-sm p-3 bg-white">
                <p className="text-sm text-warm-text whitespace-pre-wrap leading-relaxed break-words">
                  {reward.content}
                </p>
              </div>
              {reward.imageUrl && (
                <div className="mt-3 rounded-2xl overflow-hidden clay-sm">
                  <img
                    src={reward.imageUrl}
                    alt={reward.title}
                    className="w-full object-cover max-h-60"
                  />
                </div>
              )}
              {onClose && (
                <div className="mt-3">
                  <ClayButton variant="secondary" size="sm" onClick={onClose}>
                    닫기
                  </ClayButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
