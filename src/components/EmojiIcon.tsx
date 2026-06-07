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
 * Renders a unicode emoji as a flat Fluent SVG (Microsoft Fluent Emoji, MIT)
 * from /public/icons/fluent/<codepoint>.svg.
 *
 * It deliberately does NOT fall back to the raw OS emoji glyph — the app is
 * all-flat-icons by design, and a stray OS emoji is exactly the bug we keep
 * hitting. A missing SVG instead shows a neutral placeholder (and shouts in
 * dev). `scripts/check-icons.mjs` fails the build if any used emoji lacks its
 * SVG, so the placeholder never actually ships.
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
    // Neutral placeholder — never the raw OS emoji.
    return (
      <span
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`inline-block align-[-0.15em] rounded-[4px] bg-grape-100/70 ${className}`}
        style={{ width: size, height: size }}
      />
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
      onError={() => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            `[EmojiIcon] missing flat SVG for "${emoji}" (codepoint ${codepoint(emoji)}). ` +
              `Add public/icons/fluent/${codepoint(emoji)}.svg — raw OS emoji are never rendered.`,
          );
        }
        setFailed(true);
      }}
      className={`inline-block align-[-0.15em] ${className}`}
    />
  );
}
