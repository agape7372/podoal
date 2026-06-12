'use client';

import { useEffect, useRef, useState } from 'react';
import { feedbackTap } from '@/lib/feedback';

interface BoardCardMenuProps {
  /** 삭제(확인 다이얼로그를 호출 측에서 연다). */
  onDelete: () => void;
}

// 카드의 보조 동작 진입점 — 현재는 '삭제' 단일 항목(제품 결정 2026-06-12: 열기=카드 탭,
// 수확=스와이프 트레이로 일원화). 카드의 overflow-hidden 클립 '바깥'(형제)에 두어
// 드롭다운이 잘리지 않고, 카드 포인터 핸들러로 이벤트가 새지 않게 pointer 계열을
// stopPropagation 한다.
export default function BoardCardMenu({ onDelete }: BoardCardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // 바깥 클릭 / Escape 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onDocPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 열릴 때 첫 항목으로 포커스 이동
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const stop = (e: React.PointerEvent) => e.stopPropagation();

  const run = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div ref={rootRef} className="absolute top-1.5 right-1.5 z-10">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="포도판 메뉴 (삭제)"
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={(e) => { e.stopPropagation(); feedbackTap(); setOpen((v) => !v); }}
        className="w-8 h-8 rounded-full grid place-items-center text-warm-sub active:scale-95 transition-transform"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="포도판 동작"
          onPointerDown={stop}
          className="absolute top-9 right-0 min-w-[148px] py-1.5 clay-float bg-clay-bg overflow-hidden"
          style={{ borderRadius: 16 }}
        >
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={run(onDelete)}
            className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2.5 transition-colors text-red-600 hover:bg-red-50 focus-visible:bg-red-50"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
