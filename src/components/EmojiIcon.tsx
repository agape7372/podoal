'use client';

import { useState } from 'react';

interface EmojiIconProps {
  /** The emoji character to render (e.g. "🍇"). Resolved to a Fluent flat SVG by codepoint. */
  emoji: string;
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
  /** Accessible label. Omit for purely decorative icons (renders aria-hidden). */
  label?: string;
}

/**
 * Renders a unicode emoji as a color-illustration SVG (Microsoft Fluent Emoji, MIT)
 * from /public/icons/fluent/<codepoint>.svg — unifying every emoji with the profile
 * grape (/avatars/grape.svg, also Fluent). Keyed by the emoji character itself, so
 * stored values (message.emoji, capsule.emoji) render through the same path with no
 * data migration. If the SVG is missing it falls back to the raw emoji glyph, so a
 * not-yet-downloaded codepoint degrades gracefully instead of showing a broken image.
 */
function codepoint(emoji: string): string {
  return Array.from(emoji)
    .map((ch) => ch.codePointAt(0)!.toString(16))
    .filter((h) => h !== 'fe0f' && h !== '200d') // drop variation selector / ZWJ joiners
    .join('-');
}

export default function EmojiIcon({ emoji, size = 24, className = '', label }: EmojiIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`inline-block align-[-0.15em] leading-none ${className}`}
        style={{ fontSize: size * 0.9 }}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`/icons/fluent/${codepoint(emoji)}.svg`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      onError={() => setFailed(true)}
      className={`inline-block align-[-0.15em] ${className}`}
    />
  );
}
