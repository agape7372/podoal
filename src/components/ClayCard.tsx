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
  white: '',
  pink: 'bg-pink-50/50',
  mint: 'bg-emerald-50/50',
  lavender: 'bg-grape-50/60',
  peach: 'bg-orange-50/50',
  cream: 'bg-amber-50/40',
  yellow: 'bg-yellow-50/40',
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
        ${colorBg[color]}
        p-5
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
