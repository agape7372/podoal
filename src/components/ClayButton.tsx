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
    'bg-grape-500 hover:bg-grape-600 text-white border-warm-border',
  secondary:
    'bg-lime-200 hover:bg-lime-300 text-warm-text border-warm-border',
  ghost:
    'bg-transparent text-warm-text border-transparent hover:bg-grape-100 shadow-none',
  danger:
    'bg-grape-700 hover:bg-grape-800 text-white border-warm-border',
  joyful:
    'text-warm-text border-warm-border ' +
    'bg-gradient-to-br from-grape-300 via-grape-400 to-lime-300 ' +
    'hover:from-grape-400 hover:via-grape-500 hover:to-lime-400 hover:text-white',
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
