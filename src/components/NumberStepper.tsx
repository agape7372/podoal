'use client';

import { useRef, useState } from 'react';
import { feedbackTap } from '@/lib/feedback';

interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  /** Unit label rendered inline next to the number (e.g. "10알"). */
  unit?: string;
}

/**
 * Touch-friendly number picker: − / center / +.
 * The center number can be DRAGGED vertically (up = increase) or TAPPED to type
 * a value directly. − / + buttons give fine control. Always clamped to [min,max].
 */
export default function NumberStepper({ value, onChange, min, max, unit = '알' }: NumberStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const drag = useRef<{ startY: number; startVal: number; moved: boolean } | null>(null);

  const STEP_PX = 8; // vertical px per ±1

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* not capturable — drag still works via move events */ }
    drag.current = { startY: e.clientY, startVal: value, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY; // drag up → larger
    if (Math.abs(dy) > 4) d.moved = true;
    const next = clamp(d.startVal + dy / STEP_PX);
    if (next !== value) onChange(next);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      // Treated as a tap → switch to direct input.
      setDraft(String(value));
      setEditing(true);
    }
  };

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) setDraft(String(value)); // 빈/잘못된 입력이면 현재값 복구
    else onChange(clamp(n));
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-center gap-4 select-none">
      <button
        type="button"
        onClick={() => { feedbackTap(); onChange(clamp(value - 1)); }}
        disabled={value <= min}
        aria-label="줄이기"
        className="clay-button w-12 h-12 rounded-full text-2xl font-bold text-grape-600 disabled:opacity-40 flex items-center justify-center"
      >
        −
      </button>

      <div className="w-32 text-center">
        {editing ? (
          <span className="inline-flex items-baseline justify-center gap-1 w-full">
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={draft}
              min={min}
              max={max}
              onChange={(e) => {
                // Live-commit: 입력 즉시 부모(value)로 전파해 '다음' 버튼 1탭으로 진행되게 한다.
                // (이전엔 onBlur에서만 커밋 → 버튼 pointerdown이 blur→commit을 먼저 소비해 click이 삼켜짐)
                const raw = e.target.value;
                setDraft(raw);
                const n = parseInt(raw, 10);
                if (!Number.isNaN(n)) onChange(clamp(n));
              }}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
              className="clay-input text-center font-display text-4xl font-bold tabular-nums w-20"
            />
            <span className="font-display text-2xl font-bold text-warm-sub">{unit}</span>
          </span>
        ) : (
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { drag.current = null; }}
            aria-label={`포도알 개수 ${value}개. 위아래로 드래그하거나 눌러서 직접 입력`}
            style={{ touchAction: 'none' }}
            className="inline-flex items-baseline justify-center gap-1 font-display text-grape-700 tabular-nums cursor-ns-resize w-full leading-none py-1"
          >
            <span className="text-5xl font-bold">{value}</span>
            <span className="text-2xl font-bold text-warm-sub">{unit}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => { feedbackTap(); onChange(clamp(value + 1)); }}
        disabled={value >= max}
        aria-label="늘리기"
        className="clay-button w-12 h-12 rounded-full text-2xl font-bold text-grape-600 disabled:opacity-40 flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}
