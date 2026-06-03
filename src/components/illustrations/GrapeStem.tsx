interface GrapeStemProps {
  size?: number;
  className?: string;
}

/**
 * Two flat curved leaves (no stem) — sits on top of the grape board.
 * Wing-like silhouette: pointed tips splaying outward with a small notch
 * where they meet. Flat solid fill, no gradients / no outline strokes.
 * Wider than tall (W:H ≈ 3:2) so it reads as a small canopy.
 */
export default function GrapeStem({ size = 120, className = '' }: GrapeStemProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.66)}
      viewBox="0 0 120 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* right leaf */}
      <path
        d="M 60 60 C 76 52, 92 40, 88 12 C 86 7, 82 7, 80 13 C 73 30, 66 44, 60 60 Z"
        fill="#55B26E"
      />
      {/* left leaf */}
      <path
        d="M 60 60 C 44 52, 28 40, 32 12 C 34 7, 38 7, 40 13 C 47 30, 54 44, 60 60 Z"
        fill="#55B26E"
      />
    </svg>
  );
}
