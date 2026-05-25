interface VineLeafProps {
  size?: number;
  className?: string;
  flip?: boolean;
}

export default function VineLeaf({ size = 32, className = '', flip = false }: VineLeafProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="vine-leaf-fill" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#BFE3C5" />
          <stop offset="60%" stopColor="#6BBE7E" />
          <stop offset="100%" stopColor="#4A8C58" />
        </radialGradient>
      </defs>
      <path
        d="M 16 4
           C 22 4, 28 8, 28 16
           C 28 22, 22 28, 16 28
           C 10 28, 4 22, 4 16
           C 4 8, 10 4, 16 4 Z"
        fill="url(#vine-leaf-fill)"
        transform="rotate(-20 16 16)"
      />
      <path
        d="M 7 22 Q 16 14 25 9"
        stroke="#3F7D4D"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M 12 19 Q 15 17 17 14"
        stroke="#3F7D4D"
        strokeWidth="0.7"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </svg>
  );
}
