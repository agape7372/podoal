'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import ClayButton from './ClayButton';
import Sparkle from './illustrations/Sparkle';
import { feedbackReward } from '@/lib/feedback';

interface RewardRevealProps {
  reward: RewardInfo;
  isCompleted: boolean;
  onClose?: () => void;
  initialRevealed?: boolean;
}

const SPARKLE_RING = [
  { x: 50, y: -8, color: '#FFC845', size: 18 },
  { x: 92, y: 18, color: '#FF8FA3', size: 14 },
  { x: 100, y: 50, color: '#FFE08A', size: 16 },
  { x: 92, y: 82, color: '#FF8FA3', size: 12 },
  { x: 50, y: 108, color: '#FFC845', size: 18 },
  { x: 8, y: 82, color: '#A8D8B0', size: 14 },
  { x: 0, y: 50, color: '#FFE08A', size: 16 },
  { x: 8, y: 18, color: '#A8D8B0', size: 12 },
] as const;

export default function RewardReveal({
  reward,
  isCompleted,
  onClose,
  initialRevealed = false,
}: RewardRevealProps) {
  const [isRevealed, setIsRevealed] = useState(initialRevealed);
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const handleReveal = () => {
    if (!isCompleted) return;
    setIsRevealed(true);
    triggerConfetti();
    feedbackReward();
  };

  useEffect(() => {
    if (isRevealed) triggerConfetti();
  }, [isRevealed, triggerConfetti]);

  // Mixed warm-accent confetti palette
  const confettiColors = [
    '#9B7ED8', '#B294E2',
    '#FF8FA3', '#FF6B8A',
    '#FFE08A', '#FFC845',
    '#A8D8B0', '#6BBE7E',
  ];

  return (
    <div className="relative">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[200]">
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: confettiColors[i % confettiColors.length],
                animationDelay: `${Math.random() * 0.6}s`,
                animationDuration: `${1.6 + Math.random() * 1.1}s`,
                width: `${6 + Math.random() * 9}px`,
                height: `${6 + Math.random() * 9}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </div>
      )}

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
            <div className="text-6xl mb-4 animate-float">
              {isCompleted ? '🎁' : '🔒'}
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
            <div className="text-5xl mb-3">
              {reward.type === 'letter' ? '💌' : reward.type === 'giftcard' ? '🎁' : '⭐'}
            </div>
            <div className="text-xs font-medium text-grape-600 mb-2">
              {REWARD_TYPE_LABELS[reward.type]}
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
