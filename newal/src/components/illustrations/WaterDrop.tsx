interface WaterDropProps {
  size?: number;
  className?: string;
}

export default function WaterDrop({ size = 20, className = '' }: WaterDropProps) {
  return (
    <svg
      width={size * 0.7}
      height={size}
      viewBox="0 0 14 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="water-drop-fill" cx="40%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#E0F2FF" />
          <stop offset="55%" stopColor="#A8D8FF" />
          <stop offset="100%" stopColor="#6BAEE6" />
        </radialGradient>
      </defs>
      <path
        d="M 7 1.5
           C 11 6.5, 12.5 11, 12.5 13.5
           C 12.5 16.5, 10 18.5, 7 18.5
           C 4 18.5, 1.5 16.5, 1.5 13.5
           C 1.5 11, 3 6.5, 7 1.5 Z"
        fill="url(#water-drop-fill)"
      />
      <ellipse cx="5" cy="11" rx="1.5" ry="2.6" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
