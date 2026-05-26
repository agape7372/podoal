'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ClayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'joyful';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ClayButtonProps['variant']>, string> = {
  primary:
    'bg-pop-red hover:bg-pop-red-dark text-white border-pop-ink',
  secondary:
    'bg-clay-cream hover:bg-clay-yellow text-pop-ink border-pop-ink',
  ghost:
    'bg-transparent text-pop-ink border-transparent hover:bg-clay-yellow/60 shadow-none',
  danger:
    'bg-pop-red-dark hover:bg-pop-red text-white border-pop-ink',
  joyful:
    'text-pop-ink border-pop-ink ' +
    'bg-gradient-to-br from-pop-mustard via-pop-mustard to-pop-red ' +
    'hover:from-pop-red hover:to-pop-mustard hover:text-white',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-sm rounded-2xl',
  md: 'px-6 py-3 text-base rounded-[22px]',
  lg: 'px-8 py-4 text-lg rounded-[28px]',
};

export default function ClayButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  ...props
}: ClayButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        clay-button font-bold no-select
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>잠시만요…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
