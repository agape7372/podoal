interface CloudPuffProps {
  size?: number;
  className?: string;
}

export default function CloudPuff({ size = 56, className = '' }: CloudPuffProps) {
  return (
    <svg
      width={size}
      height={size * 0.57}
      viewBox="0 0 56 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cloud-fill" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F2ECF8" />
        </radialGradient>
      </defs>
      <path
        d="M 12 22
           C 6 22, 4 16, 8 13
           C 8 8, 14 6, 18 10
           C 20 6, 28 6, 30 11
           C 36 8, 42 12, 41 17
           C 48 17, 50 23, 44 25
           Z"
        fill="url(#cloud-fill)"
        stroke="rgba(155,126,216,0.18)"
        strokeWidth="1.2"
      />
    </svg>
  );
}
