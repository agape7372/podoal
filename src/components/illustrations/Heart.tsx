interface HeartProps {
  size?: number;
  className?: string;
  color?: string;
  outline?: string;
}

export default function Heart({
  size = 24,
  className = '',
  color = '#E55A4D',
  outline = '#2A2434',
}: HeartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 12 21
           C 12 21, 3 14.5, 3 8.5
           C 3 5.5, 5.5 3, 8.5 3
           C 10.3 3, 11.5 4, 12 5
           C 12.5 4, 13.7 3, 15.5 3
           C 18.5 3, 21 5.5, 21 8.5
           C 21 14.5, 12 21, 12 21 Z"
        fill={color}
        stroke={outline}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="9" cy="8" rx="1.4" ry="1.8" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}
