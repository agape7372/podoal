interface PodoProps {
  size?: number;
  /** Kept for API compatibility; no longer affects rendering (the bespoke
   *  still-life with its sleeping variant was retired in favor of the icon). */
  variant?: 'default' | 'sleeping';
  className?: string;
  ariaLabel?: string;
  decorative?: boolean;
}

/**
 * App grape mark. Renders the unified Fluent grape icon
 * (`/avatars/grape.svg` — the very same grape used by the profile Avatar and the
 * 🍇 EmojiIcon), so the empty states, welcome hero and install-prompt chip all
 * match the header avatar grape. (Previously a custom still-life SVG; swapped to
 * the icon per design request.)
 *
 * `no-img-element` is disabled project-wide — a raw <img> of this small static
 * SVG is intentional (next/image can't optimize it and it must match Avatar).
 */
export default function Podo({
  size = 96,
  className = '',
  ariaLabel = '포도 한 송이',
  decorative = false,
}: PodoProps) {
  return (
    <img
      src="/avatars/grape.svg"
      width={size}
      height={size}
      draggable={false}
      className={className}
      alt={decorative ? '' : ariaLabel}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
