interface PodoProps {
  size?: number;
  variant?: 'default' | 'sleeping';
  className?: string;
  ariaLabel?: string;
}

const GRAPES = [
  { cx: 28, cy: 56 },
  { cx: 50, cy: 56 },
  { cx: 72, cy: 56 },
  { cx: 39, cy: 76 },
  { cx: 61, cy: 76 },
  { cx: 50, cy: 95 },
] as const;

export default function Podo({
  size = 96,
  variant = 'default',
  className = '',
  ariaLabel = '포도 한 송이',
}: PodoProps) {
  const height = Math.round(size * 1.2);
  const uid = variant;

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 100 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <radialGradient id={`podo-grape-${uid}`} cx="30%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#E5CEF8" />
          <stop offset="32%" stopColor="#C9B0EE" />
          <stop offset="72%" stopColor="#9B7ED8" />
          <stop offset="100%" stopColor="#6E54AA" />
        </radialGradient>
        <radialGradient id={`podo-leaf-${uid}`} cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#B8E3BF" />
          <stop offset="55%" stopColor="#6BBE7E" />
          <stop offset="100%" stopColor="#4A8C58" />
        </radialGradient>
        <radialGradient id={`podo-shine-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`podo-bottom-shade-${uid}`} cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="rgba(74,54,121,0.0)" />
          <stop offset="100%" stopColor="rgba(74,54,121,0.18)" />
        </radialGradient>
      </defs>

      {/* Stem (main) */}
      <path
        d="M 50 7 Q 47 17 50 25 Q 53 31 49 36"
        stroke="#6B4B2C"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tendril curl on the right */}
      <path
        d="M 54 12 Q 62 9 66 14 Q 67 19 61 21 Q 57 21 56 18"
        stroke="#7B5635"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Leaf — to the upper right of cluster */}
      <path
        d="M 52 24
           C 60 16, 74 14, 84 22
           C 88 32, 82 40, 74 41
           C 64 41, 56 36, 52 28
           Z"
        fill={`url(#podo-leaf-${uid})`}
      />
      {/* Leaf central vein */}
      <path
        d="M 54 28 Q 68 28 80 26"
        stroke="#3F7D4D"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* Side vein */}
      <path
        d="M 62 28 Q 64 32 64 36"
        stroke="#3F7D4D"
        strokeWidth="0.7"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />

      {/* Grape cluster — 6 berries, 3-2-1 triangle */}
      {GRAPES.map((g, i) => (
        <g key={i}>
          <circle cx={g.cx} cy={g.cy} r="12" fill={`url(#podo-grape-${uid})`} />
          <circle
            cx={g.cx}
            cy={g.cy}
            r="12"
            fill={`url(#podo-bottom-shade-${uid})`}
          />
          <ellipse
            cx={g.cx - 3.2}
            cy={g.cy - 4.2}
            rx="3.6"
            ry="2.8"
            fill={`url(#podo-shine-${uid})`}
          />
        </g>
      ))}

      {/* Sleeping: tiny ZZ above-right of cluster */}
      {variant === 'sleeping' && (
        <g opacity="0.7">
          <text
            x="78"
            y="20"
            fontFamily="MaruBuri, serif"
            fontSize="11"
            fontWeight="700"
            fill="#7A6A8E"
            transform="rotate(8 78 20)"
          >
            Z
          </text>
          <text
            x="86"
            y="11"
            fontFamily="MaruBuri, serif"
            fontSize="8"
            fontWeight="700"
            fill="#7A6A8E"
            transform="rotate(8 86 11)"
          >
            z
          </text>
        </g>
      )}
    </svg>
  );
}
