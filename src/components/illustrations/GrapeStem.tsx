import { useId } from 'react';

interface GrapeStemProps {
  size?: number;
  className?: string;
}

/**
 * Stem + leaf + tendril cluster — sits on top of the grape board.
 * Designed to be wider than tall (W:H ≈ 3:2) for a graceful canopy.
 */
export default function GrapeStem({ size = 120, className = '' }: GrapeStemProps) {
  const uid = useId();
  const fillId = `stem-leaf-fill-${uid}`;
  return (
    <svg
      width={size}
      height={Math.round(size * 0.66)}
      viewBox="0 0 120 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={fillId} cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#BFE3C5" />
          <stop offset="55%" stopColor="#6BBE7E" />
          <stop offset="100%" stopColor="#4A8C58" />
        </radialGradient>
      </defs>

      {/* Main stem coming down */}
      <path
        d="M 60 8 Q 58 22 60 36 Q 62 46 58 56 Q 56 64 60 72"
        stroke="#6B4B2C"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Tendril (left, curly) */}
      <path
        d="M 56 28
           Q 48 26, 40 32
           Q 32 38, 36 46
           Q 40 50, 46 46
           Q 50 42, 46 38"
        stroke="#7B5635"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Tendril (right, smaller) */}
      <path
        d="M 66 22
           Q 76 18, 80 24
           Q 82 30, 76 32"
        stroke="#7B5635"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Big leaf */}
      <path
        d="M 64 16
           C 76 4, 102 4, 110 22
           C 112 38, 96 48, 82 46
           C 70 46, 62 36, 60 24
           Z"
        fill={`url(#${fillId})`}
      />
      {/* Leaf central vein */}
      <path
        d="M 68 26 Q 86 22 104 18"
        stroke="#3F7D4D"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* Side veins */}
      <path
        d="M 76 26 Q 80 32 82 38"
        stroke="#3F7D4D"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M 88 24 Q 92 30 94 36"
        stroke="#3F7D4D"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
