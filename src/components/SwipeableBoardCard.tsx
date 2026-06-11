'use client';

import type { PointerEventHandler } from 'react';
import type { BoardSummary } from '@/types';
import BoardCard from './BoardCard';
import BoardCardMenu from './BoardCardMenu';
import EmojiIcon from './EmojiIcon';

/** Spring-back easing for the swipe layer. The home gesture layer writes
 *  transform/transition straight to the DOM during a drag — keep its writes and
 *  the declarative style below using this exact same value. */
export const SWIPE_TRANSITION = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';

interface SwipeableBoardCardProps {
  board: BoardSummary;
  /** RESTING horizontal offset of the card layer in px (≤ 0 = tray open committed).
   *  The live finger-following offset is NOT rendered through this prop — the
   *  parent writes it directly to the DOM via `moveLayerRef` so pointermove
   *  doesn't re-render the whole list. */
  offset: number;
  /** Visually lifted for drag-to-reorder (scale + glow + raised z). */
  lifted: boolean;
  /** The finger is actively swiping this card (axis locked to x). Turns the
   *  declarative transition off and hides the ⋮ menu. */
  dragging: boolean;
  /** Pixel width of the revealed action tray. */
  trayWidth: number;
  onHarvest: () => void;
  onDelete: () => void;
  /** Keyboard/SR path to open the board detail (pointer tap is handled by the gesture layer). */
  onOpen: () => void;
  /** Outer (non-translating) element ref — used by the parent for drag hit-testing. */
  innerRef: (el: HTMLElement | null) => void;
  /** Translating card-layer ref — the parent drives transform/transition on it
   *  directly during the swipe (perf: no per-pointermove setState). */
  moveLayerRef: (el: HTMLElement | null) => void;
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
  dragging,
  trayWidth,
  onHarvest,
  onDelete,
  onOpen,
  innerRef,
  moveLayerRef,
  pointerHandlers,
}: SwipeableBoardCardProps) {
  const harvested = !!board.harvestedAt;
  // 서버는 완성된 보드만 수확 허용. harvested 보드는 항상 완성 상태이므로 되돌리기는 항상 가능.
  const canHarvest = board.isCompleted;
  const revealed = offset <= -1;

  return (
    <div ref={innerRef} className={`relative ${lifted ? 'z-20' : ''}`}>
      {/* 클립 반경은 카드(.clay-float = 28px)와 반드시 일치시켜야 한다. 더 작으면(예: 20px)
          카드의 둥근 모서리 바깥·클립 안쪽 틈으로 뒤의 빨간 삭제 트레이가 비친다.
          포인터 제스처는 이 래퍼가 소유한다(트레이 포함) — 열린 트레이 위에서 시작한
          드래그로도 카드를 닫을 수 있다. 트레이 버튼 탭은 부모의 슬롭(gMoved) 판정으로
          드래그와 구분되고, 축 잠금 시 부모가 포인터를 캡처해 click이 버튼에 닿지 않는다. */}
      <div
        {...pointerHandlers}
        className="relative overflow-hidden touch-pan-y"
        style={{ borderRadius: 28 }}
      >
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

        {/* Moving card layer — role/tabIndex/onKeyDown give keyboard + screen-reader
            users a way to OPEN the board (the swipe/longpress gestures are pointer-only,
            owned by the wrapper above); harvest/delete via keyboard is the ⋮ menu below.
            touch-action 기본값은 인라인이 아니라 클래스(touch-pan-y)여야 한다 — 제스처
            레이어가 인라인 값을 ''로 비워도 클래스 값으로 자연 복귀한다. (React는 vdom
            prev/next가 같은 인라인 값을 재기록하지 않아, 인라인 기본값은 한 번 비워지면
            복구 경로가 없다.) */}
        <div
          ref={moveLayerRef}
          role="button"
          tabIndex={lifted ? -1 : 0}
          aria-label={`${board.title} 열기 · ${board.filledCount}/${board.totalStickers}알`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
          className={`relative touch-pan-y ${lifted ? 'shadow-grape-glow' : ''}`}
          style={{
            transform: `translateX(${offset}px) scale(${lifted ? 1.02 : 1})`,
            transition: dragging ? 'none' : SWIPE_TRANSITION,
            ...(lifted ? { touchAction: 'none' as const } : null),
          }}
        >
          <BoardCard board={board} asStatic reserveTopRight />
        </div>
      </div>

      {/* ⋮ 메뉴 — overflow-hidden 클립 '바깥'(형제)이라 드롭다운이 잘리지 않고, 카드 포인터
          핸들러로 이벤트가 새지 않는다. 스와이프 드래그/열림/정렬 리프트 중엔 제스처 UI에 양보해 숨김. */}
      {!revealed && !lifted && !dragging && (
        <BoardCardMenu
          onOpen={onOpen}
          onHarvest={onHarvest}
          onDelete={onDelete}
          canHarvest={canHarvest}
          harvested={harvested}
        />
      )}
    </div>
  );
}
