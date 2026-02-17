'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import ClayButton from './ClayButton';

interface RewardRevealProps {
  reward: RewardInfo;
  isCompleted: boolean;
  onClose?: () => void;
}

export default function RewardReveal({ reward, isCompleted, onClose }: RewardRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const handleReveal = () => {
    if (!isCompleted) return;
    setIsRevealed(true);
    triggerConfetti();
  };

  useEffect(() => {
    if (isRevealed) triggerConfetti();
  }, [isRevealed, triggerConfetti]);

  const confettiColors = ['#9B7ED8', '#FFD4E0', '#C5EBD6', '#FFE4CC', '#FFF3C4', '#E0D4F5'];

  return (
    <div className="relative">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[200]">
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: confettiColors[i % confettiColors.length],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 1}s`,
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </div>
      )}

      {!isRevealed ? (
        /* Locked reward box */
        <div
          onClick={handleReveal}
          className={`
            clay-float p-8 text-center
            ${isCompleted ? 'cursor-pointer reward-glow' : 'opacity-75'}
            bg-grape-50/80
          `}
        >
          <div className="text-6xl mb-4 animate-float">
            {isCompleted ? '🎁' : '🔒'}
          </div>
          <h3 className="text-lg font-bold text-grape-700 mb-2">
            {isCompleted ? '보상을 확인하세요!' : '보상이 숨겨져 있어요'}
          </h3>
          <p className="text-sm text-warm-sub">
            {isCompleted
              ? '터치하여 열어보세요 ✨'
              : '모든 포도알을 채우면 확인할 수 있어요'}
          </p>
          <div className="mt-3 text-sm text-grape-500 font-medium">
            {REWARD_TYPE_LABELS[reward.type]}
          </div>
        </div>
      ) : (
        /* Revealed reward */
        <div className="clay-float p-6 animate-reward-reveal">
          <div className="text-center">
            <div className="text-5xl mb-3">
              {reward.type === 'letter' ? '💌' : reward.type === 'giftcard' ? '🎁' : '⭐'}
            </div>
            <div className="text-xs font-medium text-grape-500 mb-2">
              {REWARD_TYPE_LABELS[reward.type]}
            </div>
            <h3 className="text-xl font-bold text-grape-700 mb-4">
              {reward.title}
            </h3>
            <div className="clay-sm p-5 text-left">
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
