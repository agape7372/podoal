interface GrapeStemProps {
  size?: number;
  className?: string;
}

/**
 * Two flat leaves on a short sprig — sits on top of the grape board.
 * Deliberately flat (solid fills, no gradients / no outline strokes) for a
 * clean modern look. Wider than tall (W:H ≈ 3:2) so it reads as a canopy.
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
      {/* short sprig */}
      <path
        d="M 60 74 L 60 48"
        stroke="#5BA86E"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* back (right) leaf — slightly darker so the two leaves read apart */}
      <path
        d="M 61 50 C 75 45, 90 33, 90 15 C 77 24, 67 38, 61 50 Z"
        fill="#4F9C62"
      />
      <path
        d="M 63 48 Q 76 32 88 18"
        stroke="#3C7A4C"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />

      {/* front (left) leaf — lighter, sits on top */}
      <path
        d="M 59 50 C 45 45, 30 33, 30 15 C 43 24, 53 38, 59 50 Z"
        fill="#6FC183"
      />
      <path
        d="M 57 48 Q 44 32 32 18"
        stroke="#3C7A4C"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
