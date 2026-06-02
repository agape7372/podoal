'use client';

import { useMemo, type CSSProperties } from 'react';

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
  // 채움 입자 12개 — position 기반 결정적 시드로 산출(Math.random 미사용 → SSR/hydration 안전)
  const dots = useMemo(() => {
    const N = 12;
    return Array.from({ length: N }, (_, i) => {
      const seed = (position * N + i) * 12.9898;
      const rnd = (k: number) => {
        const v = Math.sin(seed + k * 78.233) * 43758.5453;
        return v - Math.floor(v); // 0..1
      };
      const a = i * (360 / N) + (rnd(1) - 0.5) * 10; // 30° 균등 + ±5° 지터
      const d = 11 + rnd(2) * 3;                      // 11~14px (알 크기 비례, 클립 안전)
      const delay = Math.round(rnd(3) * 30);          // 0~30ms stagger
      return { a, d, delay };
    });
  }, [position]);

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

      {/* 채워진 직후 1회성 보상: 과즙 채움(주역) + 2겹 플래시 링 + 12입자 버스트
          (버튼 기준 절대배치 자식 — active:scale·grape-jelly-pop transform과 충돌 없음) */}
      {isJustFilled && (
        <>
          <span className="grape-juice" aria-hidden="true">
            <span className="grape-juice__below" />
            <span className="grape-juice__wave">
              <i className="w-a" />
              <i className="w-b" />
            </span>
          </span>
          <span className="grape-ring" aria-hidden="true" />
          <span className="grape-ring-rim" aria-hidden="true" />
          <span className="burst-layer" aria-hidden="true">
            {dots.map((p, i) => (
              <span
                key={i}
                className="burst-dot"
                style={{
                  ['--a' as string]: `${p.a.toFixed(1)}deg`,
                  ['--d' as string]: `${p.d.toFixed(1)}px`,
                  ['--delay' as string]: `${p.delay}ms`,
                } as CSSProperties}
              />
            ))}
          </span>
        </>
      )}
    </button>
  );
}
