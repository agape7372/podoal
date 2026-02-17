'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ClayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles = {
  primary: 'bg-grape-500 hover:bg-grape-600 text-white',
  secondary: 'bg-grape-50 hover:bg-grape-100 text-grape-700',
  ghost: 'bg-transparent text-grape-600 shadow-none border-transparent hover:bg-grape-50',
  danger: 'bg-red-400 hover:bg-red-500 text-white',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-6 py-3 text-base rounded-2xl',
  lg: 'px-8 py-4 text-lg rounded-2xl',
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
          <span>잠시만요...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
