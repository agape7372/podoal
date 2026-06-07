'use client';

import { useEffect, useState } from 'react';

// Classic multi-color party confetti.
const CONFETTI_COLORS = [
  '#FF3B30', '#FF9500',
  '#FFCC00', '#34C759',
  '#00C7BE', '#007AFF',
  '#5856D6', '#FF2D55',
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
    <div className="fixed inset-0 pointer-events-none z-[200]" aria-hidden="true">
      {pieces.map((piece, i) => (
        // key includes `trigger` so each burst remounts fresh DOM → animation restarts.
        <div key={`${trigger}-${i}`} className="confetti-particle" style={piece} />
      ))}
    </div>
  );
}
