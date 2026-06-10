'use client';

import type { PointerEventHandler } from 'react';
import type { BoardSummary } from '@/types';
import BoardCard from './BoardCard';
import EmojiIcon from './EmojiIcon';

interface SwipeableBoardCardProps {
  board: BoardSummary;
  /** Horizontal offset of the card layer in px (≤ 0 reveals the right action tray). */
  offset: number;
  /** Visually lifted for drag-to-reorder (scale + glow + raised z). */
  lifted: boolean;
  /** Animate the transform (off while the finger is actively dragging the swipe). */
  animating: boolean;
  /** Pixel width of the revealed action tray. */
  trayWidth: number;
  onHarvest: () => void;
  onDelete: () => void;
  /** Keyboard/SR path to open the board detail (pointer tap is handled by the gesture layer). */
  onOpen: () => void;
  /** Outer (non-translating) element ref — used by the parent for drag hit-testing. */
  innerRef: (el: HTMLElement | null) => void;
  pointerHandlers: {
    onPointerDown: PointerEventHandler;
    onPointerMove: PointerEventHandler;
    onPointerUp: PointerEventHandler;
    onPointerCancel: PointerEventHandler;
  };
}

export default function SwipeableBoardCard({
  board,
  offset,
  lifted,
  animating,
  trayWidth,
  onHarvest,
  onDelete,
  onOpen,
  innerRef,
  pointerHandlers,
}: SwipeableBoardCardProps) {
  const harvested = !!board.harvestedAt;
  // 서버는 완성된 보드만 수확 허용. harvested 보드는 항상 완성 상태이므로 되돌리기는 항상 가능.
  const canHarvest = board.isCompleted;
  const revealed = offset <= -1;

  return (
    <div ref={innerRef} className={`relative ${lifted ? 'z-20' : ''}`}>
      {/* 클립 반경은 카드(.clay-float = 28px)와 반드시 일치시켜야 한다. 더 작으면(예: 20px)
          카드의 둥근 모서리 바깥·클립 안쪽 틈으로 뒤의 빨간 삭제 트레이가 비친다. */}
      <div className="relative overflow-hidden" style={{ borderRadius: 28 }}>
        {/* Right-side action tray, revealed as the card slides left */}
        <div
          className="absolute inset-y-0 right-0 flex items-stretch gap-1.5"
          style={{ width: trayWidth }}
          aria-hidden={!revealed}
        >
          <button
            type="button"
            onClick={onHarvest}
            aria-disabled={!canHarvest}
            title={canHarvest ? undefined : '포도판을 다 채우면 수확할 수 있어요'}
            tabIndex={revealed ? 0 : -1}
            className={`flex-1 rounded-2xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors ${
              harvested
                ? 'bg-leaf-100 text-leaf-700'
                : canHarvest
                  ? 'bg-grape-100 text-grape-700'
                  : 'bg-warm-border/40 text-warm-light cursor-not-allowed'
            }`}
          >
            <EmojiIcon emoji="🍇" size={16} />
            {harvested ? '되돌리기' : '수확'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            tabIndex={revealed ? 0 : -1}
            className="flex-1 rounded-2xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 bg-red-500 text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            삭제
          </button>
        </div>

        {/* Moving card layer — owns the pointer gesture. role/tabIndex/onKeyDown give
            keyboard + screen-reader users a way to OPEN the board (the swipe/longpress
            gestures are pointer-only); harvest/delete via keyboard is the kebab menu (M2). */}
        <div
          {...pointerHandlers}
          role="button"
          tabIndex={lifted ? -1 : 0}
          aria-label={`${board.title} 열기 · ${board.filledCount}/${board.totalStickers}알`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
          className={`relative ${lifted ? 'shadow-grape-glow' : ''}`}
          style={{
            transform: `translateX(${offset}px) scale(${lifted ? 1.02 : 1})`,
            transition: animating ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
            touchAction: lifted ? 'none' : 'pan-y',
          }}
        >
          <BoardCard board={board} asStatic />
        </div>
      </div>
    </div>
  );
}
