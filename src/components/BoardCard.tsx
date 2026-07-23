'use client';

import { useRouter } from 'next/navigation';
import type { HTMLAttributes, ReactNode } from 'react';
import type { BoardSummary } from '@/types';
import EmojiIcon from './EmojiIcon';
import { feedbackTap } from '@/lib/feedback';
import { progressPercent } from '@/lib/format';
import { stripTitleEmoji } from '@/lib/title';

interface BoardCardProps {
  board: BoardSummary;
  /** Render as a non-interactive <div> (the home gesture wrapper owns gestures/nav). */
  asStatic?: boolean;
  /** Shift the source badge left so it doesn't sit under the ⋮ menu (home cards). */
  reserveTopRight?: boolean;
  /** 미니 포도알 트레이 행 '오른쪽'에 인라인으로 붙는 액션 — 홈의 '수확하기' 버튼용.
   *  ⚠ `asStatic`일 때만 렌더한다: 비정적 분기의 카드 루트는 `<button>`이라
   *  버튼을 끼우면 중첩 버튼(무효 HTML + 클릭 삼킴)이 된다. 친구 상세
   *  (friends/[id])는 비정적 사용이라 이 prop을 넘기지 않아 렌더 무변화. */
  footer?: ReactNode;
  /** `asStatic` 전용: 카드의 '보드 열기' role="button" 속성 — 홈이 여기에
   *  role="button"/tabIndex/onKeyDown을 넣어 키보드·스크린리더의 '보드 열기' 경로를
   *  만든다. asStatic 분기는 이 속성을 inner 래퍼가 아닌 `absolute inset-0` 오버레이
   *  형제에 얹는다(스트레치드 링크): 그래야 트레이 행의 footer(수확 버튼)가
   *  role="button"의 자손 = 중첩 인터랙티브가 되지 않는다. */
  bodyProps?: HTMLAttributes<HTMLDivElement>;
  className?: string;
}

// 출처 코너 칩: 선물받음 → 💝 선물, 포도동(group) → 🔗 포도동, 자작 → 없음.
function sourceBadge(board: BoardSummary): { emoji: string; text: string; label: string } | null {
  if (board.giftedFrom) return { emoji: '💝', text: '선물', label: '선물받은 포도판' };
  if (board.podong) return { emoji: '🔗', text: '포도동', label: '포도동 포도판' };
  return null;
}

export default function BoardCard({ board, asStatic = false, reserveTopRight = false, footer, bodyProps, className = '' }: BoardCardProps) {
  const router = useRouter();
  const progress = progressPercent(board.filledCount, board.totalStickers);
  const badge = sourceBadge(board);
  const harvested = !!board.harvestedAt;
  // 채움 텀 C2(FILL_CADENCE_PLAN §3): "오늘 몫 완료" 배지 — 리스트 과밀 방지 위해
  // 카드당 배지 총량 2개 상한(harvested + source). 이미 2개면 paceDone은 생략(우선순위 낮음).
  const showPaceDone = board.paceDone === true && (harvested ? 1 : 0) + (badge ? 1 : 0) < 2;

  const inner = (
    <>
      <div className="flex-1 min-w-0">
        {/* 코너 칩(수확·출처) — absolute 대신 제목 행 안 inline-flex로 두어, 칩 폭이 변해도
            truncate 제목과 절대 겹치지 않는다(작은 화면 안전). reserveTopRight는 카드 '바깥'
            형제인 ⋮ 메뉴(top-1.5 right-1.5, w-8 → 콘텐츠 박스로 22px 침범) 자리만 비운다. */}
        <div className={`flex items-center gap-1.5 mb-1 ${reserveTopRight ? 'pr-7' : ''}`}>
          {board.isCompleted && <EmojiIcon emoji="🎉" size={16} className="shrink-0" />}
          <h3 className="flex-1 min-w-0 font-display text-[17px] font-bold text-warm-text truncate">{stripTitleEmoji(board.title)}</h3>
          {harvested && (
            <span className="shrink-0 w-6 h-6 rounded-full bg-white/85 clay-sm grid place-items-center" title="수확 완료">
              <EmojiIcon emoji="🏆" size={14} label="수확 완료" />
            </span>
          )}
          {badge && (
            <span className="shrink-0 h-6 inline-flex items-center gap-1 pl-1.5 pr-2 rounded-full bg-white/85 clay-sm" title={badge.label}>
              <EmojiIcon emoji={badge.emoji} size={13} />
              <span className="text-[11px] font-semibold text-warm-sub leading-none">{badge.text}</span>
            </span>
          )}
          {showPaceDone && (
            <span className="shrink-0 h-6 inline-flex items-center gap-1 pl-2 pr-1.5 rounded-full bg-white/85 clay-sm" title="오늘 몫 완료">
              <span className="text-[11px] font-semibold text-warm-sub leading-none">오늘 몫 완료</span>
              <EmojiIcon emoji="🍇" size={13} />
            </span>
          )}
        </div>
        {board.description && (
          <p className="text-xs text-warm-sub truncate mb-3">{board.description}</p>
        )}

        {/* Mini grape preview tray + (asStatic 전용) 우측 수확/되돌리기 알약.
            트레이는 inline-flex라 왼쪽으로 수축 → 오른쪽 빈 공간에 알약을 flex
            우측정렬로 얹는다(설명문 유무·픽셀계산 무관, items-center로 세로 자동정렬).
            ⚠ 알약(footer)이 여기에 오려면 이 행이 role="button"(bodyProps)의 자손이
            아니어야 한다 — asStatic 분기가 bodyProps를 inner 래퍼가 아닌 형제 오버레이로
            두어 그 조건을 보장한다(아래 asStatic return 참고). */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="clay-pressed inline-flex flex-wrap gap-[3px] px-2 py-1.5" style={{ borderRadius: '12px' }}>
            {Array.from({ length: Math.min(board.totalStickers, 10) }, (_, i) => {
              const isFilled = i < board.filledCount;
              return (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full ${
                    isFilled ? 'grape-filled-mini' : 'grape-empty-mini'
                  }`}
                />
              );
            })}
            {board.totalStickers > 10 && (
              <span className="text-[10px] text-warm-sub self-center ml-0.5">
                +{board.totalStickers - 10}
              </span>
            )}
          </div>
          {asStatic && footer && <div className="shrink-0">{footer}</div>}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-clay-bg overflow-hidden">
          <div
            // width 대신 scaleX — 진행 변화 시 프레임마다 레이아웃을 유발하지 않는다
            // (컴포지터 전용). 그라데이션은 요소 박스 기준이라 두 방식의 시각이 동일.
            className="h-full w-full origin-left rounded-full bg-linear-to-r from-grape-500 via-grape-400 to-lime-300 transition-transform"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-[10px] text-warm-sub tabular-nums">
            <span className="font-display font-semibold text-warm-text">{board.filledCount}</span>
            <span className="mx-0.5">/</span>
            {board.totalStickers}알
          </span>
          <span className="flex items-center gap-1.5">
            {board.rewardCount > 0 && (
              <EmojiIcon emoji={board.isCompleted ? '🎁' : '🔒'} size={13} />
            )}
            <span className="text-[10px] font-display font-bold text-grape-600 tabular-nums">{progress}%</span>
          </span>
        </div>
      </div>
    </>
  );

  if (asStatic) {
    // '보드 열기' role="button"을 inner 래퍼가 아닌 absolute inset-0 오버레이(스트레치드
    // 링크 패턴)로 둔다 — inner가 role=button의 자손이 아니게 되어야 트레이 행의 수확 알약
    // (footer)이 중첩 인터랙티브가 되지 않는다. 콘텐츠는 relative z-10로 오버레이 위에 두어
    // 알약 클릭이 삼켜지지 않는다(오버레이는 positioned라 기본적으로 static 위에 그려짐).
    // 오버레이는 키보드/SR '열기'만 담당(전역 :focus-visible 링이 카드 테두리에 표시).
    // 탭=열기는 BoardRow 제스처 레이어 소유라 오버레이에 onClick은 없다.
    return (
      <div className={`clay-float relative w-full p-4 text-left ${className}`}>
        {bodyProps && <div {...bodyProps} className="absolute inset-0 rounded-[28px]" />}
        <div className="relative z-10">{inner}</div>
      </div>
    );
  }

  return (
    <button
      onClick={() => { feedbackTap(); router.push(`/board/${board.id}`); }}
      className={`clay-float relative w-full p-4 text-left active:scale-[0.98] transition-transform ${className}`}
    >
      {inner}
    </button>
  );
}
