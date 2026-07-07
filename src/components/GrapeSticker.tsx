'use client';

interface GrapeStickerProps {
  position: number;
  isFilled: boolean;
  isJustFilled: boolean;
  isFilling: boolean;
  canFill: boolean;
  isNext?: boolean;   // the next-in-sequence grape (sequential fill) — highlighted & tappable
  dimmed?: boolean;   // an unfilled grape that's locked until earlier ones are filled
  /** 채움 텀 C1(FILL_CADENCE_PLAN §3): 다음 알이 텀 대기 중("익는 중")이면 true —
   *  청포도→라벤더 색 전이(grape-ripening, globals.css 선반영)를 켠다. isNext 전용. */
  ripening?: boolean;
  /** 익음 정도 0~1 — CSS 변수 --ripen-p로 전달(ripening=false면 무시). */
  ripenProgress?: number;
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
  ripening = false,
  ripenProgress,
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
          ? `grape-filled ${isJustFilled ? 'grape-hit' : ''}`
          : 'grape-empty'
        }
        ${canFill ? 'cursor-pointer active:scale-90' : ''}
        ${isNext ? 'grape-next' : ''}
        ${isNext && ripening ? 'grape-ripening' : ''}
        ${dimmed ? 'opacity-70' : ''}
        ${!canFill || isFilling ? 'pointer-events-none' : ''}
      `}
      style={isNext && ripening ? ({ '--ripen-p': ripenProgress ?? 0 } as React.CSSProperties) : undefined}
      aria-label={isFilled ? '채워진 포도알' : `포도알 ${position + 1}`}
    >
      {!isFilled && (
        <span className={`
          font-medium select-none tabular-nums ${isNext ? 'text-grape-700/80' : 'text-warm-sub/70'}
          ${size === 'lg' ? 'text-xs' : size === 'md' ? 'text-[10px]' : 'text-[8px]'}
        `}>
          {position + 1}
        </span>
      )}

      {/* 채워진 직후 1회성: 히트스톱 임팩트 프리즈(본체 grape-hit 스쿼시) + 임팩트 플래시 링
          (플래시는 버튼 기준 절대배치 자식 — active:scale·grape-hit transform과 충돌 없음) */}
      {isJustFilled && (
        <span className="grape-flash" aria-hidden="true" />
      )}
    </button>
  );
}
