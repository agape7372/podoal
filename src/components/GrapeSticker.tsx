'use client';

interface GrapeStickerProps {
  position: number;
  isFilled: boolean;
  isJustFilled: boolean;
  isFilling: boolean;
  canFill: boolean;
  size: 'sm' | 'md' | 'lg';
  onClick: () => void;
}

const sizeMap = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

export default function GrapeSticker({
  isFilled,
  isJustFilled,
  isFilling,
  canFill,
  size,
  onClick,
}: GrapeStickerProps) {
  return (
    <button
      onClick={onClick}
      disabled={!canFill || isFilling}
      className={`
        ${sizeMap[size]}
        rounded-full no-select
        transition-all duration-200
        flex items-center justify-center
        ${isFilled
          ? `clay-grape ${isJustFilled ? 'animate-grape-fill' : ''}`
          : 'clay-grape-empty'
        }
        ${isFilling ? 'animate-pulse' : ''}
        ${canFill ? '' : isFilled ? '' : 'opacity-90'}
      `}
      aria-label={isFilled ? '채워진 포도알' : '빈 포도알'}
    >
      {isFilled ? (
        <span className={`text-lg ${isJustFilled ? 'animate-pop' : ''}`}>🍇</span>
      ) : (
        <span className="text-warm-light/50 text-xs">○</span>
      )}
    </button>
  );
}
