'use client';

import { useEffect, useRef, useState } from 'react';
import { useCachedApi } from '@/lib/cachedApi';
import {
  WINERY_TIERS,
  BOTTLE_SIZE_LABELS,
  type WineryTier,
  type WineBottle as WineBottleType,
} from '@/lib/winery';
import WineBottle, { BOTTLE_BASELINE_H, BOTTLE_ROW_H } from '@/components/WineBottle';
import EmojiIcon from '@/components/EmojiIcon';
import { stripTitleEmoji } from '@/lib/title';

interface WineryData {
  totalGrapes: number;
  currentTier: WineryTier;
  nextTier: WineryTier | null;
  tierProgress: number;
  bottles: WineBottleType[];
}

// ─── 티어 시각 레코드 ───────────────────────────────────────
// winery.ts의 tier.color는 @source가 src/lib를 스캔하지 않아 CSS가 조용히
// 미생성되는 지뢰 위에 있었다(Lv3·5·7 글로우 완전 투명 — CLAUDE.md의 @source
// 항목이 실제로 문 사례). 스캔되는 이 파일 안의 리터럴이 시각 정본이다.
// (티어 임계값·이름 정본은 여전히 src/lib/winery.ts — 상호 참조 주석 유지)
// Lv3·5·7의 옛 orange/amber는 팔레트 규약에 맞춰 sunshine-* 토큰으로 재조색
// — 버그 수정이자 의도적 색 결정.
const TIER_GLOW: Record<number, string> = {
  1: 'from-grape-100 to-grape-50',
  2: 'from-grape-200 to-grape-100',
  3: 'from-sunshine-200 to-sunshine-100',
  4: 'from-grape-300 to-grape-200',
  5: 'from-sunshine-300 to-sunshine-200',
  6: 'from-grape-400 to-grape-300',
  7: 'from-sunshine-400 to-sunshine-300',
};

// 셀러 앰비언트 조명 — 티어가 오르면 저장고의 빛이 바뀐다(공간 서사).
// 인라인 radial-gradient rgba 리터럴이라 @source와 무관. 값은 @theme의
// grape/sunshine 실제 hex에서 유도(low-opacity 워시).
const TIER_AMBIENT: Record<number, string> = {
  1: 'rgba(244, 236, 251, 0.55)', // grape-100
  2: 'rgba(235, 224, 246, 0.55)', // grape-200
  3: 'rgba(253, 239, 180, 0.35)', // sunshine-200
  4: 'rgba(220, 196, 242, 0.45)', // grape-300
  5: 'rgba(249, 224, 130, 0.30)', // sunshine-300
  6: 'rgba(201, 168, 232, 0.40)', // grape-400
  7: 'rgba(242, 201, 76, 0.25)',  // sunshine-400
};

export default function WineryPage() {
  // SWR 캐시: 재방문 시 직전 데이터로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, refresh } = useCachedApi<WineryData>('/api/winery');
  const [selectedBottle, setSelectedBottle] = useState<WineBottleType | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Bring the detail panel into view when a bottle is selected (it opens below
  // the cellar, which can sit off-screen in a tall cellar).
  useEffect(() => {
    if (selectedBottle) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedBottle]);

  // ─── Loading Skeleton ───────────────────────────────────
  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">
          <EmojiIcon emoji="🏰" size={24} className="mr-1.5" />포도 와이너리
        </h1>
        <div className="space-y-4">
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-64 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="pb-4">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">
          <EmojiIcon emoji="🏰" size={24} className="mr-1.5" />포도 와이너리
        </h1>
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={refresh} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      </div>
    );
  }

  const { totalGrapes, currentTier, nextTier, tierProgress, bottles } = data;
  const grapesToNext = nextTier ? nextTier.minGrapes - totalGrapes : 0;

  // Wooden shelf plank drawn at the shared bottle baseline, repeated once per row.
  const shelfPitch = BOTTLE_ROW_H + 24; // cell height + gap-y-6
  const cellarShelf = `repeating-linear-gradient(to bottom, transparent 0 ${BOTTLE_BASELINE_H}px, rgba(146,100,56,0.30) ${BOTTLE_BASELINE_H}px ${BOTTLE_BASELINE_H + 4}px, rgba(83,55,28,0.16) ${BOTTLE_BASELINE_H + 4}px ${BOTTLE_BASELINE_H + 7}px, transparent ${BOTTLE_BASELINE_H + 7}px ${shelfPitch}px)`;

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6 animate-fade-in">
        <EmojiIcon emoji="🏰" size={24} className="mr-1.5" />포도 와이너리
      </h1>

      {/* ─── Tier Display Section ──────────────────────────── */}
      <section className="clay-float p-6 mb-6 animate-fade-in relative overflow-hidden">
        {/* Background glow matching tier color — TIER_GLOW(스캔 보장 리터럴) 참조.
            currentTier.color(winery.ts)를 직접 쓰면 CSS 미생성(@source 지뢰). */}
        <div
          className={`absolute inset-0 bg-linear-to-br ${TIER_GLOW[currentTier.level]} opacity-20 pointer-events-none`}
        />

        <div className="relative z-10 text-center">
          {/* Tier icon with glow */}
          <div className="relative inline-block mb-3">
            <EmojiIcon
              emoji={currentTier.icon}
              size={72}
              label={currentTier.name}
              className="block animate-float mx-auto"
            />
            {/* Glow ring — TIER_GLOW 참조(위와 동일 사유) */}
            <div
              className={`absolute inset-0 -m-3 rounded-full bg-linear-to-br ${TIER_GLOW[currentTier.level]} opacity-40 blur-xl pointer-events-none`}
            />
          </div>

          {/* Tier name + level badge */}
          <h2 className="font-display text-xl font-bold text-grape-800 mb-1">
            {currentTier.name}
          </h2>
          <span className="inline-block px-3 py-0.5 rounded-full text-xs font-bold text-white bg-linear-to-br from-grape-700 to-grape-800">
            Lv.{currentTier.level}
          </span>

          {/* Total grapes */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <EmojiIcon emoji="🍇" size={26} />
            <span className="font-display text-4xl font-extrabold text-grape-700 leading-none tabular-nums">
              {totalGrapes.toLocaleString()}
            </span>
            <span className="text-sm text-warm-sub self-end mb-1">포도알</span>
          </div>

          {/* Progress bar to next tier */}
          {nextTier ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-warm-sub mb-1.5">
                <span className="inline-flex items-center gap-1"><EmojiIcon emoji={currentTier.icon} size={14} /> Lv.{currentTier.level}</span>
                <span className="inline-flex items-center gap-1"><EmojiIcon emoji={nextTier.icon} size={14} /> Lv.{nextTier.level}</span>
              </div>
              <div
                className="w-full h-4 rounded-full bg-white/60 overflow-hidden shadow-inner relative"
                role="progressbar"
                aria-valuenow={Math.round(tierProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${currentTier.name}에서 ${nextTier.name}까지 진행률`}
              >
                <div
                  className="h-full rounded-full bg-linear-to-r from-grape-400 via-grape-500 to-grape-600 transition-all duration-1000 ease-out relative"
                  style={{ width: `${tierProgress}%` }}
                >
                  {/* Animated shimmer on progress bar */}
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
              <p className="text-xs text-warm-sub mt-2">
                다음 티어까지 <span className="font-bold text-grape-600 tabular-nums">{grapesToNext.toLocaleString()}</span>포도알
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-grape-600 font-semibold">
                <EmojiIcon emoji="👑" size={18} className="mr-0.5" /> 최고 등급 달성!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Wine Cellar Section ───────────────────────────── */}
      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-grape-700">
            <EmojiIcon emoji="🍷" size={20} className="mr-1" />와인 셀러
          </h3>
          <span className="text-sm text-warm-sub font-medium tabular-nums">
            {bottles.length}병
          </span>
        </div>

        {bottles.length === 0 ? (
          /* Empty state */
          <div className="clay p-8 text-center">
            <EmojiIcon emoji="🍾" size={52} className="block mx-auto mb-4 animate-float" />
            <p className="text-warm-sub text-sm leading-relaxed">
              아직 완성된 와인이 없어요.
              <br />
              포도판을 완성하면 와인이 만들어져요!
              <EmojiIcon emoji="🍇" size={16} className="ml-1" />
            </p>
          </div>
        ) : (
          <>
            {/* Bottle grid — each row stands on a wooden shelf (repeating
                background plank at the shared bottle baseline). */}
            <div className="clay p-5 relative overflow-hidden">
              {/* 티어 앰비언트 조명 — 승급하면 셀러의 빛이 바뀐다. 인라인 rgba
                  리터럴(TIER_AMBIENT)이라 @source 스캔과 무관. 장식 전용. */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${TIER_AMBIENT[currentTier.level]}, transparent 72%)`,
                }}
              />
              <div
                className="grid grid-cols-3 sm:grid-cols-4 gap-y-6 gap-x-2 justify-items-center"
                style={{ backgroundImage: cellarShelf }}
              >
                {bottles.map((bottle) => (
                  <WineBottle
                    key={bottle.boardId}
                    bottle={bottle}
                    selected={selectedBottle?.boardId === bottle.boardId}
                    onClick={() =>
                      setSelectedBottle(
                        selectedBottle?.boardId === bottle.boardId ? null : bottle
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {/* Selected bottle detail panel */}
            {selectedBottle && (
              <div ref={detailRef} className="clay-sm mt-3 p-5 bg-grape-50/60 animate-slide-up relative">
                {/* Close button */}
                <button
                  onClick={() => setSelectedBottle(null)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-warm-sub hover:bg-white hover:text-grape-600 transition-colors text-sm"
                  aria-label="닫기"
                >
                  {'\u{2715}'}
                </button>

                <div className="flex items-start gap-4">
                  {/* Mini bottle icon area */}
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-grape-500 to-grape-700 flex items-center justify-center shadow-md">
                      <EmojiIcon emoji="🍷" size={26} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4 className="text-base font-bold text-grape-800 mb-2 wrap-break-word">
                      {stripTitleEmoji(selectedBottle.title)}
                    </h4>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                      <DetailRow
                        label="빈티지"
                        value={`${selectedBottle.vintage}년`}
                      />
                      <DetailRow
                        label="숙성 기간"
                        value={`${selectedBottle.daysToComplete}일`}
                      />
                      <DetailRow
                        label="포도알"
                        value={`${selectedBottle.totalStickers}개`}
                      />
                      <DetailRow
                        label="병 사이즈"
                        value={BOTTLE_SIZE_LABELS[selectedBottle.bottleSize].split(' (')[0]}
                      />
                    </div>

                    {/* Completion date */}
                    <p className="text-xs text-warm-sub mt-2">
                      {formatDate(selectedBottle.completedAt)} 완성
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ─── Tier Roadmap Section ──────────────────────────── */}
      <section className="mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h3 className="font-display text-lg font-bold text-grape-700 mb-4">
          <EmojiIcon emoji="🗺️" size={20} className="mr-1" />티어 로드맵
        </h3>

        <div className="clay p-5">
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[22px] top-4 bottom-4 w-0.5 bg-linear-to-b from-grape-300 via-grape-200 to-warm-border/30" />

            <div className="space-y-1">
              {WINERY_TIERS.map((tier) => {
                const isPast = totalGrapes >= tier.minGrapes && tier.level < currentTier.level;
                const isCurrent = tier.level === currentTier.level;
                const isFuture = tier.level > currentTier.level;

                return (
                  <div
                    key={tier.level}
                    className={`
                      relative flex items-center gap-3 py-3 px-3 rounded-2xl transition-all duration-300
                      ${isCurrent ? 'shadow-xs' : ''}
                      ${isFuture ? 'opacity-40' : ''}
                    `}
                  >
                    {/* NOW 행 하이라이트 — TIER_GLOW 동일 레코드 참조(티어 색과 동조).
                        아주 밝은 톤의 30% 워시라 위 콘텐츠 가독성 영향 없음. */}
                    {isCurrent && (
                      <div
                        aria-hidden
                        className={`absolute inset-0 rounded-2xl bg-linear-to-r ${TIER_GLOW[tier.level]} opacity-30 pointer-events-none`}
                      />
                    )}
                    {/* Node dot on the line */}
                    <div
                      className={`
                        relative z-10 w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0
                        ${isCurrent
                          ? 'bg-linear-to-br from-grape-400 to-grape-600 shadow-lg ring-2 ring-grape-300 ring-offset-2'
                          : isPast
                            ? 'bg-linear-to-br from-grape-200 to-grape-300 shadow-xs'
                            : 'bg-warm-border/40 shadow-xs'
                        }
                      `}
                    >
                      {isPast ? (
                        <span className="text-grape-700 text-sm font-bold">{'\u{2713}'}</span>
                      ) : (
                        <EmojiIcon emoji={tier.icon} size={24} />
                      )}
                    </div>

                    {/* Tier info — relative로 NOW 워시 레이어 위에 페인트 */}
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isCurrent
                              ? 'text-grape-700'
                              : isPast
                                ? 'text-grape-600'
                                : 'text-warm-sub'
                          }`}
                        >
                          {tier.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-white bg-grape-500 rounded-full px-2 py-0.5">
                            NOW
                          </span>
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-warm-sub">
                        {tier.minGrapes === 0
                          ? '시작'
                          : `${tier.minGrapes.toLocaleString()}포도알 필요`}
                      </span>
                    </div>

                    {/* Level badge */}
                    <span
                      className={`relative text-xs font-bold shrink-0 tabular-nums ${
                        isCurrent
                          ? 'text-grape-600'
                          : isPast
                            ? 'text-grape-400'
                            : 'text-warm-sub'
                      }`}
                    >
                      Lv.{tier.level}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-warm-sub text-xs">{label}</span>
      <p className="text-grape-700 font-semibold text-sm tabular-nums">{value}</p>
    </div>
  );
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}. ${m}. ${day}.`;
}
