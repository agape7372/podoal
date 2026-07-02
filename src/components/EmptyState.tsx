'use client';

import { useState, type ReactNode } from 'react';
import EmojiIcon from './EmojiIcon';

interface EmptyStateProps {
  /** 씬 일러스트 경로(/illustrations/empty/…-v1.webp). 미지정 또는 로드 실패 시
      폴백 아이콘으로 렌더 — 아트 생성 전에도 안전하게 배선해 둘 수 있다.
      자산 명세·생성 프롬프트는 docs/ILLUSTRATION_STYLE.md 카탈로그 참조. */
  art?: string;
  /** 폴백(그리고 아트 도입 전의 기본) 아이콘 — EmojiIcon 규약대로 이모지 문자. */
  fallbackEmoji?: string;
  /** fallbackEmoji 대신 쓸 커스텀 폴백 노드(예: 홈의 <Podo> — 헤더 아바타와 동일해야
      하는 설계 의도 보존). art가 있으면 아트가 우선. */
  icon?: ReactNode;
  /** 아트 표시 크기(px). 이모지 폴백은 시각 균형상 절반 크기로 렌더. */
  artSize?: number;
  title: string;
  description?: string;
  /** CTA 등 부가 콘텐츠. */
  children?: ReactNode;
  className?: string;
}

/**
 * 공용 빈 상태 — "일러스트(또는 아이콘) + 제목 + 설명 + CTA" 패턴의 단일 정본.
 * 이미지는 장식(aria-hidden)이고 의미는 title 텍스트가 전달한다. 아트 파일이
 * 없거나 로드에 실패하면 기존 UX(플랫 이모지/마스코트)로 자동 폴백 — 생 OS
 * 이모지 노출 없음(EmojiIcon 경유).
 */
export default function EmptyState({
  art,
  fallbackEmoji,
  icon,
  artSize = 120,
  title,
  description,
  children,
  className = '',
}: EmptyStateProps) {
  const [artFailed, setArtFailed] = useState(false);
  const showArt = art && !artFailed;

  return (
    <div className={`text-center py-12 ${className}`}>
      {showArt ? (
        <img
          src={art}
          alt=""
          aria-hidden="true"
          width={artSize}
          height={artSize}
          loading="lazy"
          decoding="async"
          className="block mx-auto mb-4"
          onError={() => setArtFailed(true)}
        />
      ) : icon ? (
        <div className="flex justify-center mb-3">{icon}</div>
      ) : fallbackEmoji ? (
        <EmojiIcon
          emoji={fallbackEmoji}
          size={Math.round(artSize / 2)}
          className="block mx-auto mb-3"
        />
      ) : null}
      <p className="font-display text-base font-bold text-warm-text mb-1">{title}</p>
      {description && <p className="text-sm text-warm-sub">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
