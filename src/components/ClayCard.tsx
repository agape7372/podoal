'use client';

import { ReactNode } from 'react';

interface ClayCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'float' | 'pressed' | 'small' | 'puffy';
  onClick?: () => void;
  color?: 'white' | 'pink' | 'mint' | 'lavender' | 'peach' | 'cream' | 'yellow';
}

const colorBg: Record<string, string> = {
  white: '',
  pink: 'bg-clay-pink/55',
  mint: 'bg-clay-mint/55',
  lavender: 'bg-clay-lavender/60',
  peach: 'bg-clay-peach/50',
  cream: 'bg-clay-cream/60',
  yellow: 'bg-clay-yellow/55',
};

const baseClass: Record<NonNullable<ClayCardProps['variant']>, string> = {
  default: 'clay',
  float: 'clay-float',
  pressed: 'clay-pressed',
  small: 'clay-sm',
  puffy: 'clay-puffy',
};

export default function ClayCard({
  children,
  className = '',
  variant = 'default',
  onClick,
  color = 'white',
}: ClayCardProps) {
  const classes = `
    ${baseClass[variant]}
    ${colorBg[color]}
    p-5
    ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform text-left w-full' : ''}
    ${className}
  `;

  // When interactive, render a real <button> so it is keyboard-operable and
  // announced as a control (was a div with onClick — div-soup interactivity).
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
