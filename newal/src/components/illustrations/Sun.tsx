interface SunProps {
  size?: number;
  className?: string;
}

export default function Sun({ size = 48, className = '' }: SunProps) {
  const rays = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sun-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF5C9" />
          <stop offset="60%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor="#FFC845" />
        </radialGradient>
      </defs>
      {rays.map((deg) => (
        <line
          key={deg}
          x1="24"
          y1="6"
          x2="24"
          y2="11"
          stroke="#FFC845"
          strokeWidth="2.2"
          strokeLinecap="round"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="10" fill="url(#sun-fill)" />
    </svg>
  );
}
