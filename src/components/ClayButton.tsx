'use client';

import Link from 'next/link';
import { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react';

type CommonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'joyful';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
};

// href가 있으면 <button> 대신 <Link>로 렌더 — 클레이 비주얼은 동일하게 유지하면서
// 라우트 프리페치를 얻는다(navigation 전용 CTA용, FAB 전환과 같은 이유).
// disabled/loading 게이트와 버튼 고유 속성(type/onPointerDown 등)은 버튼 분기 전용.
type ClayButtonProps =
  | ({ href?: undefined } & CommonProps & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & CommonProps & {
      onClick?: MouseEventHandler<HTMLAnchorElement>;
      className?: string;
      'aria-label'?: string;
    });

const variantStyles: Record<NonNullable<ClayButtonProps['variant']>, string> = {
  primary:
    'bg-grape-700 hover:bg-grape-800 text-white border-warm-border',
  secondary:
    'bg-lime-200 hover:bg-lime-300 text-warm-text border-warm-border',
  ghost:
    'bg-transparent text-warm-text border-transparent hover:bg-grape-100 shadow-none',
  danger:
    'bg-rose-500 hover:bg-rose-600 text-white border-warm-border',
  joyful:
    'text-warm-text border-warm-border ' +
    'bg-linear-to-br from-grape-300 via-grape-400 to-lime-300 ' +
    'hover:from-grape-400 hover:via-grape-500 hover:to-lime-400 hover:text-white',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-sm rounded-2xl',
  md: 'px-6 py-3 text-base rounded-[22px]',
  lg: 'px-8 py-4 text-lg rounded-[28px]',
};

export default function ClayButton(props: ClayButtonProps) {
  const { children, variant = 'primary', size = 'md', fullWidth = false, loading = false, className = '' } = props;

  const visual = `
    clay-button font-bold no-select
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${fullWidth ? 'w-full' : ''}
  `;

  const content = loading ? (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      <span>잠시만요…</span>
    </span>
  ) : (
    // Wrap children in a flex row so an inline <EmojiIcon> img sits centered
    // beside its label instead of breaking baseline/clipping — this is the
    // 🎁 "T" tofu on 포도판 선물하기 / 선물 심기 buttons.
    <span className="inline-flex items-center justify-center gap-1.5">{children}</span>
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        aria-label={props['aria-label']}
        // 버튼은 기본 inline-block + 가운데 정렬이지만 앵커는 아니라서 명시한다.
        className={`inline-block text-center ${visual} ${className}`}
      >
        {content}
      </Link>
    );
  }

  const {
    href: _href,
    children: _children,
    variant: _variant,
    size: _size,
    fullWidth: _fullWidth,
    loading: _loading,
    className: _className,
    disabled,
    type,
    ...buttonProps
  } = props;
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={`
        ${visual}
        ${loading ? 'cursor-wait' : ''}
        ${disabled && !loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
