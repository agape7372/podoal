interface SparkleProps {
  size?: number;
  className?: string;
  color?: string;
}

export default function Sparkle({
  size = 20,
  className = '',
  color = '#CFDC78',
}: SparkleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 10 1
           Q 11 8, 19 10
           Q 11 12, 10 19
           Q 9 12, 1 10
           Q 9 8, 10 1 Z"
        fill={color}
      />
      <circle cx="10" cy="10" r="1.4" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}
