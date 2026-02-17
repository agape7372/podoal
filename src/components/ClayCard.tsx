'use client';

import { ReactNode } from 'react';

interface ClayCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'float' | 'pressed' | 'small';
  onClick?: () => void;
  color?: 'white' | 'pink' | 'mint' | 'lavender' | 'peach' | 'cream' | 'yellow';
}

const colorBg: Record<string, string> = {
  white: 'from-white to-grape-50/30',
  pink: 'from-clay-pink/60 to-clay-pink/30',
  mint: 'from-clay-mint/60 to-clay-mint/30',
  lavender: 'from-clay-lavender/60 to-clay-lavender/30',
  peach: 'from-clay-peach/60 to-clay-peach/30',
  cream: 'from-clay-cream/60 to-clay-cream/30',
  yellow: 'from-clay-yellow/60 to-clay-yellow/30',
};

export default function ClayCard({
  children,
  className = '',
  variant = 'default',
  onClick,
  color = 'white',
}: ClayCardProps) {
  const base = variant === 'float' ? 'clay-float' : variant === 'pressed' ? 'clay-pressed' : variant === 'small' ? 'clay-sm' : 'clay';

  return (
    <div
      onClick={onClick}
      className={`
        ${base}
        bg-gradient-to-br ${colorBg[color]}
        p-5
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
