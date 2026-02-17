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

export default function GrapeSticker({
  position,
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
        w-full h-full rounded-full no-select relative
        transition-all duration-200
        flex items-center justify-center
        ${isFilled
          ? `grape-filled ${isJustFilled ? 'animate-grape-fill' : ''}`
          : 'grape-empty'
        }
        ${isFilling ? 'animate-pulse scale-90' : ''}
        ${canFill ? 'cursor-pointer active:scale-90' : ''}
      `}
      aria-label={isFilled ? '채워진 포도알' : `포도알 ${position + 1}`}
    >
      {!isFilled && (
        <span className={`
          font-medium select-none text-warm-light/40
          ${size === 'lg' ? 'text-xs' : size === 'md' ? 'text-[10px]' : 'text-[8px]'}
        `}>
          {position + 1}
        </span>
      )}
    </button>
  );
}
