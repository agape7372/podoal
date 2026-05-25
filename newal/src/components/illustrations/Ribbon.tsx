interface RibbonProps {
  size?: number;
  className?: string;
  color?: string;
}

export default function Ribbon({
  size = 40,
  className = '',
  color = '#FF8FA3',
}: RibbonProps) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 40 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left loop */}
      <path
        d="M 20 12
           Q 10 4, 4 8
           Q 1 12, 4 16
           Q 10 20, 20 12 Z"
        fill={color}
      />
      {/* Right loop */}
      <path
        d="M 20 12
           Q 30 4, 36 8
           Q 39 12, 36 16
           Q 30 20, 20 12 Z"
        fill={color}
      />
      {/* Knot center */}
      <ellipse cx="20" cy="12" rx="3.5" ry="4" fill="#E84D6F" />
      {/* Tail left */}
      <path d="M 18 16 L 16 23 L 21 21 Z" fill={color} opacity="0.85" />
      {/* Tail right */}
      <path d="M 22 16 L 24 23 L 19 21 Z" fill={color} opacity="0.85" />
    </svg>
  );
}
