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
        d="M 60 61 C 80 54, 96 40, 90 11 C 88 5, 81 5, 78 12 C 70 27, 63 44, 60 61 Z"
        fill="#55B26E"
      />
      {/* left leaf */}
      <path
        d="M 60 61 C 40 54, 24 40, 30 11 C 32 5, 39 5, 42 12 C 50 27, 57 44, 60 61 Z"
        fill="#55B26E"
      />
    </svg>
  );
}
