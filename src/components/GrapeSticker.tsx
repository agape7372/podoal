'use client';

interface GrapeStickerProps {
  position: number;
  isFilled: boolean;
  isJustFilled: boolean;
  isFilling: boolean;
  canFill: boolean;
  isNext?: boolean;   // the next-in-sequence grape (sequential fill) — highlighted & tappable
  dimmed?: boolean;   // an unfilled grape that's locked until earlier ones are filled
  size: 'sm' | 'md' | 'lg';
  onClick: () => void;
}

export default function GrapeSticker({
  position,
  isFilled,
  isJustFilled,
  isFilling,
  canFill,
  isNext = false,
  dimmed = false,
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
          ? `grape-filled ${isJustFilled ? 'grape-jelly-pop' : ''}`
          : 'grape-empty'
        }
        ${isFilling ? 'animate-pulse scale-90' : ''}
        ${canFill ? 'cursor-pointer active:scale-90' : ''}
        ${isNext ? 'grape-next' : ''}
        ${dimmed ? 'opacity-70' : ''}
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

      {/* 채워진 직후 1회성 귀여운 보상 이펙트: 소프트 펄스 1 + 말랑 점 3
          (버튼 기준 절대배치 자식 — active:scale·grape-jelly-pop transform과 충돌 없음) */}
      {isJustFilled && (
        <>
          <span className="jelly-pulse" aria-hidden="true" />
          <span className="jelly-dot d1" aria-hidden="true" />
          <span className="jelly-dot d2" aria-hidden="true" />
          <span className="jelly-dot d3" aria-hidden="true" />
        </>
      )}
    </button>
  );
}
