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
    'bg-grape-500 hover:bg-grape-600 text-white border-grape-600/30 shadow-clay-sm',
  secondary:
    'bg-grape-50 hover:bg-grape-100 text-grape-700 border-grape-100',
  ghost:
    'bg-transparent text-grape-700 border-transparent hover:bg-grape-50 shadow-none',
  danger:
    'bg-juice-500 hover:bg-juice-600 text-white border-juice-600/30 shadow-clay-sm',
  joyful:
    'text-white border-transparent shadow-clay-puffy ' +
    'bg-gradient-to-br from-grape-500 via-grape-500 to-juice-400 ' +
    'hover:from-grape-600 hover:to-juice-500',
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
        clay-button font-semibold no-select
        transition-all duration-150
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
