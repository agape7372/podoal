'use client';

import { useEffect, useState } from 'react';

// Brand-pastel party confetti — podoal @theme 토큰 값과 동기(iOS 시스템 팔레트였던
// 오프-브랜드 8색을 grape/juice/leaf/lime/sunshine 계열로 교체).
const CONFETTI_COLORS = [
  '#c9a8e8', '#9970c8', // grape-400 / grape-600
  '#f58bae', '#c84b73', // juice-400 / juice-600
  '#8fc972', '#cfdc78', // leaf-400 / lime-500
  '#f9e082', '#e0ae2c', // sunshine-300 / sunshine-500
];
const CONFETTI_COUNT = 50;

interface ConfettiPiece {
  left: string;
  backgroundColor: string;
  animationDelay: string;
  animationDuration: string;
  width: string;
  height: string;
  borderRadius: string;
}

// Randomized in an effect (NOT during render), so each piece keeps its position
// across re-renders instead of teleporting mid-animation. Keeps render pure
// (react-hooks/purity).
function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    animationDelay: `${Math.random() * 0.6}s`,
    animationDuration: `${1.6 + Math.random() * 1.1}s`,
    width: `${6 + Math.random() * 9}px`,
    height: `${6 + Math.random() * 9}px`,
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
  }));
}

interface ConfettiProps {
  /**
   * Burst counter. Each time this changes to a new positive number a fresh
   * confetti burst plays. Drive it as a monotonically increasing counter
   * (e.g. `setTrigger((t) => t + 1)`); 0 means "no burst yet".
   */
  trigger: number;
  durationMs?: number;
}

/**
 * Full-screen one-shot confetti burst, decoupled from any single card so the
 * same celebration can fire both when a grape is filled (board page) and when a
 * reward is opened (RewardReveal). Renders nothing until `trigger` fires.
 */
export default function Confetti({ trigger, durationMs = 3000 }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;
    setPieces(makeConfetti());
    setShow(true);
    const t = setTimeout(() => setShow(false), durationMs);
    return () => clearTimeout(t);
  }, [trigger, durationMs]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-200" aria-hidden="true">
      {pieces.map((piece, i) => (
        // key includes `trigger` so each burst remounts fresh DOM → animation restarts.
        <div key={`${trigger}-${i}`} className="confetti-particle" style={piece} />
      ))}
    </div>
  );
}
