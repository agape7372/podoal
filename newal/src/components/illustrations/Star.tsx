interface StarProps {
  size?: number;
  className?: string;
  color?: string;
  outline?: string;
}

export default function Star({
  size = 24,
  className = '',
  color = '#F2A93B',
  outline = '#2A2434',
}: StarProps) {
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
        d="M 12 2.5
           L 14.6 9 L 21.5 9.5 L 16.2 14 L 18 21
           L 12 17 L 6 21 L 7.8 14 L 2.5 9.5 L 9.4 9 Z"
        fill={color}
        stroke={outline}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
