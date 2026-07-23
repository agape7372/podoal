'use client';

import type { PointerEventHandler } from 'react';
import type { BoardSummary } from '@/types';
import BoardCard from './BoardCard';
import BoardCardMenu from './BoardCardMenu';

interface BoardRowProps {
  board: BoardSummary;
  /** Visually lifted for drag-to-reorder (grape-glow ring + raised z). The glow
   *  goes on the OUTER element (this file's root) so it isn't clipped. */
  lifted: boolean;
  /** Home is awaiting this board's fill-queue drain before committing the harvest
   *  (last grape POST not yet confirmed) — swaps the button to a "수확 중…"
   *  disabled state. */
  harvesting?: boolean;
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

/**
 * 홈 보드 행 — 카드 + (완성 시) 수확 버튼 + ⋮ 메뉴.
 *
 * **가로 스와이프 수확은 2026-07-23에 폐지됐다.** 사유(사용자 판정 + 재발 이력):
 * 수확은 15~30알에 한 번뿐인 드문 축하 행위인데 스와이프-투-액션은 잦고 반복적인
 * 목록 작업에 맞는 패턴이다. 한 표면에 세로스크롤 / 탭=열기 / 롱프레스=정렬 /
 * 가로스와이프=수확 4중 경합을 손수 만든 임계값(슬롭 10px, y잠금 1.75배, 늦은 승격
 * 32px·1.2배)으로 갈랐고, 그 임계값이 기기·손가락마다 다르게 동작해 "밀어도 수확이
 * 안 된다"가 반복 재발했다. 발견성은 목록 하단 11px 안내문에만 의존했고 키보드/
 * 스크린리더 수확 경로는 아예 없었다.
 * → 완성 카드에만 상시 노출되는 명시적 CTA로 대체. 정렬 롱프레스는 유지한다.
 * 스와이프를 되살리지 말 것 — 되살리면 위 4중 경합이 그대로 돌아온다.
 */
export default function BoardRow({
  board,
  lifted,
  harvesting = false,
  onHarvest,
  onDelete,
  onOpen,
  innerRef,
  pointerHandlers,
}: BoardRowProps) {
  const harvested = !!board.harvestedAt;
  // 서버는 완성된 보드만 수확 허용. harvested 보드는 항상 완성 상태이므로 되돌리기는 항상 가능.
  const showAction = board.isCompleted || harvested;

  // outer에 rounded-[28px]: 리프트 시 grape-glow 링(box-shadow)이 카드와 같은 둥근 모양을
  // 따르게 한다(radius 없으면 글로우가 직각 = '카드는 둥근데 글로우는 네모').
  return (
    <div ref={innerRef} className={`relative rounded-[28px] ${lifted ? 'z-20 shadow-grape-glow' : ''}`}>
      {/* 포인터 제스처(탭=열기 / 롱프레스=정렬)는 이 래퍼가 소유한다. 수확 버튼 위에서
          시작한 누름은 부모(onDown)가 closest('button') 판별로 리프트 타이머를 무장하지
          않아, 버튼 click이 정렬 리프트(포인터 캡처)에 삼켜지지 않는다. 이 래퍼 안의
          유일한 <button>이 수확 CTA다(⋮ 메뉴는 래퍼 바깥 형제).
          touch-action 기본값은 인라인이 아니라 클래스(touch-pan-y)여야 한다 — 제스처
          레이어가 리프트 중 인라인 'none'을 넣었다가 ''로 비우면 클래스 값으로 자연
          복귀한다. (React는 vdom prev/next가 같은 인라인 값을 재기록하지 않아, 인라인
          기본값은 한 번 비워지면 복구 경로가 없다.) */}
      <div
        {...pointerHandlers}
        className="relative touch-pan-y"
        style={lifted ? { touchAction: 'none' } : undefined}
      >
        <BoardCard
          board={board}
          asStatic
          reserveTopRight
          // 키보드/스크린리더의 '열기' 경로. asStatic BoardCard는 이 속성을 inner가 아닌
          // absolute inset-0 오버레이(스트레치드 링크)에 얹어, 트레이 행의 수확 버튼(footer)이
          // 이 role="button"의 자손 = 중첩 인터랙티브가 되지 않게 한다(BoardCard.bodyProps 주석).
          bodyProps={{
            role: 'button',
            tabIndex: lifted ? -1 : 0,
            'aria-label': `${board.title} 열기 · ${board.filledCount}/${board.totalStickers}알`,
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            },
          }}
          footer={
            showAction ? (
              // 풀폭 그라데이션 바 폐지(2026-07-23, "너무 튄다") → 컴팩트 알약. 위치도
              // 하단 독립 행에서 포도알 트레이 행 우측 인라인으로 이동(2026-07-23, 카드
              // 세로 공간 절약). 수확은 드문 축하 행위라 은은한 grape 틴트로 존재감만
              // 남기고, 되돌리기는 비파괴 되돌림이라 무채색으로 더 죽인다. 아이콘 없음.
              // clay-sm 그림자 톤을 따르되 탭 타깃 확보(min-h 34px). active:scale-95만
              // (transition-all 금지 — motion 관례). 전역 focus-visible 링에 의존.
              // ⚠ 이 알약은 footer로 전달돼 트레이 행 우측에 렌더된다 — 중첩 인터랙티브가
              //   안 되는 건 asStatic BoardCard의 스트레치드 오버레이가 보장(bodyProps 주석).
              <button
                type="button"
                disabled={harvesting}
                onClick={onHarvest}
                className={`inline-flex items-center justify-center min-h-[34px] px-4 rounded-full
                  text-[12.5px] font-bold border border-warm-border
                  shadow-[1.5px_2px_0_rgba(73,50,100,0.05)] transition-transform active:scale-95
                  disabled:opacity-60 disabled:active:scale-100 ${
                    harvested
                      ? 'bg-clay-surface text-warm-sub'
                      : 'bg-grape-100 text-grape-700'
                  }`}
              >
                {harvesting ? '수확 중…' : harvested ? '되돌리기' : '수확하기'}
              </button>
            ) : null
          }
        />
      </div>

      {/* ⋮ 메뉴 — 카드 포인터 핸들러 '바깥'(형제)이라 드롭다운이 잘리지 않고 이벤트가
          제스처 레이어로 새지 않는다. 정렬 리프트 중엔 제스처 UI에 양보해 숨김. */}
      {!lifted && <BoardCardMenu onDelete={onDelete} />}
    </div>
  );
}
