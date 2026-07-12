'use client';

import type { PointerEventHandler } from 'react';
import type { BoardSummary } from '@/types';
import BoardCard from './BoardCard';
import BoardCardMenu from './BoardCardMenu';

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
  /** Visually lifted for drag-to-reorder (grape-glow ring + raised z). The glow
   *  goes on the OUTER element (this file's root), which sits OUTSIDE the swipe
   *  clip — so the ring isn't shaved off. The pointer-handling wrapper is left
   *  exactly as-is, so this visual fix can't affect press/longpress detection. */
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

  // outer에 rounded-[28px]: 리프트 시 grape-glow 링(box-shadow)이 카드와 같은 둥근 모양을 따르게
  // 한다(radius 없으면 글로우가 직각 = '카드는 둥근데 글로우는 네모'). overflow가 없어 클립은 안 됨.
  return (
    <div ref={innerRef} className={`relative rounded-[28px] ${lifted ? 'z-20 shadow-grape-glow' : ''}`}>
      {/* 클립 반경은 카드(.clay-float = 28px)와 반드시 일치시켜야 한다. 더 작으면(예: 20px)
          카드의 둥근 모서리 바깥·클립 안쪽 틈으로 트레이(틴트 워시·포커스 배경)가 비친다.
          포인터 제스처는 이 래퍼가 소유한다(트레이 포함) — 열린 트레이 위에서 시작한
          드래그로도 카드를 닫을 수 있다. 트레이 버튼 탭은 부모의 슬롭(gMoved) 판정으로
          드래그와 구분되고, 축 잠금 시 부모가 포인터를 캡처해 click이 버튼에 닿지 않는다. */}
      <div
        {...pointerHandlers}
        className="relative overflow-hidden touch-pan-y"
        style={{ borderRadius: 28 }}
      >
        {/* Right-side action tray — 고스트 '수확' 단일 버튼(시안 v2 1번 계열). 삭제는
            ⋮ 메뉴로 일원화(제품 결정 2026-06-12: 스와이프는 수확 손맛 전용, 카드 탭=열기).
            평소엔 배경 없는 색 글자, hover/탭에만 미세 틴트 워시가 떠오른다.
            data-tray: 부모 제스처 레이어가 여기서 시작한 누름엔 리프트(길게 누르기) 타이머를
            무장하지 않는다 — 리프트가 포인터를 캡처하면 버튼 click이 삼켜져, 길게 누른
            수확이 동작 대신 정렬 리프트로 빠진다. */}
        {/* 버튼은 고정폭(88px)·트레이 중앙 정렬 — 슬라이드 거리(trayWidth)를 키워도
            버튼 크기는 그대로, 양옆 여백만 늘어난다(시안 v2 1번의 여백감). 탭 피드백은
            시안 값 그대로: scale 0.96 + grape-300 16% 틴트 워시(모바일은 hover 부재 —
            active가 체감의 전부). */}
        {/* 풀스와이프 커밋 임계를 넘으면 부모 제스처가 data-commit="1"을 쓴다(group/tray) —
            버튼이 커지고 틴트가 짙어져 '여기서 놓으면 수확'을 예고한다. 트레이 폭도 부모의
            setCardX가 노출 폭에 맞춰 직접 늘린다(정지 시 trayWidth prop 값으로 복원됨). */}
        <div
          data-tray
          className="group/tray absolute inset-y-0 right-0 flex items-stretch justify-center"
          style={{ width: trayWidth }}
          aria-hidden={!revealed}
        >
          <button
            type="button"
            onClick={onHarvest}
            aria-disabled={!canHarvest}
            title={canHarvest ? undefined : '포도판을 다 채우면 수확할 수 있어요'}
            tabIndex={revealed ? 0 : -1}
            className={`w-[88px] rounded-2xl text-xs font-semibold flex flex-col items-center justify-center gap-[3px] transition-[transform,background-color] duration-150 active:scale-[0.96] group-data-[commit=1]/tray:scale-110 ${
              harvested
                ? 'text-leaf-700 hover:bg-leaf-100/40 active:bg-leaf-100/60 group-data-[commit=1]/tray:bg-leaf-100/70'
                : canHarvest
                  ? 'text-grape-700 hover:bg-grape-300/15 active:bg-grape-300/25 group-data-[commit=1]/tray:bg-grape-300/30'
                  : 'text-warm-sub cursor-not-allowed'
            }`}
          >
            {/* 시안 v2 1번의 단색 포도(currentColor) — 컬러 fluent 이모지는 고스트 톤을 깸 */}
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.6c1.7 0 3.2.9 4 2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="8.2" r="3.1" fill="currentColor" />
              <circle cx="8.5" cy="13.5" r="3.1" fill="currentColor" />
              <circle cx="15.5" cy="13.5" r="3.1" fill="currentColor" />
              <circle cx="12" cy="18.7" r="3.1" fill="currentColor" />
            </svg>
            {harvested ? '되돌리기' : '수확'}
          </button>
        </div>

        {/* Moving card layer — role/tabIndex/onKeyDown give keyboard + screen-reader
            users a way to OPEN the board (the swipe/longpress gestures are pointer-only,
            owned by the wrapper above); 삭제 via keyboard is the ⋮ menu below. 수확은
            스와이프 전용(포인터) — 제품 결정. 키보드 수확 경로 부재는 알려진 트레이드오프.
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
          className="relative touch-pan-y"
          style={{
            // 글로우 링은 outer(클립 밖)로 옮겼다. scale(1.02)는 클립 안쪽이라 잘려 가장자리가
            // 깎이므로 빼고, 리프트 어포던스는 outer의 grape-glow 링이 담당한다. 이 레이어는
            // translateX(스와이프)만 — 래퍼/포인터 핸들러는 일절 건드리지 않는다.
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : SWIPE_TRANSITION,
            ...(lifted ? { touchAction: 'none' as const } : null),
          }}
        >
          <BoardCard board={board} asStatic reserveTopRight />
        </div>
      </div>

      {/* ⋮ 메뉴 — overflow-hidden 클립 '바깥'(형제)이라 드롭다운이 잘리지 않고, 카드 포인터
          핸들러로 이벤트가 새지 않는다. 스와이프 드래그/열림/정렬 리프트 중엔 제스처 UI에 양보해 숨김. */}
      {!revealed && !lifted && !dragging && <BoardCardMenu onDelete={onDelete} />}
    </div>
  );
}
