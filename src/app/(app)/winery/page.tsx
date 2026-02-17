'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  WINERY_TIERS,
  BOTTLE_SIZE_LABELS,
  type WineryTier,
  type WineBottle as WineBottleType,
} from '@/lib/winery';
import WineBottle from '@/components/WineBottle';

interface WineryData {
  totalGrapes: number;
  currentTier: WineryTier;
  nextTier: WineryTier | null;
  tierProgress: number;
  bottles: WineBottleType[];
}

export default function WineryPage() {
  const [data, setData] = useState<WineryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBottle, setSelectedBottle] = useState<WineBottleType | null>(null);

  useEffect(() => {
    api<WineryData>('/api/winery')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ─── Loading Skeleton ───────────────────────────────────
  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="text-2xl font-bold text-grape-700 mb-6">
          <span className="mr-1.5">{'\u{1F3F0}'}</span>포도 와이너리
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

  if (!data) return null;

  const { totalGrapes, currentTier, nextTier, tierProgress, bottles } = data;
  const grapesToNext = nextTier ? nextTier.minGrapes - totalGrapes : 0;

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-bold text-grape-700 mb-6 animate-fade-in">
        <span className="mr-1.5">{'\u{1F3F0}'}</span>포도 와이너리
      </h1>

      {/* ─── Tier Display Section ──────────────────────────── */}
      <section className="clay-float p-6 mb-6 animate-fade-in relative overflow-hidden">
        {/* Background glow matching tier color */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${currentTier.color} opacity-30 pointer-events-none`}
        />

        <div className="relative z-10 text-center">
          {/* Tier icon with glow */}
          <div className="relative inline-block mb-3">
            <span
              className="text-6xl block animate-float"
              role="img"
              aria-label={currentTier.name}
            >
              {currentTier.icon}
            </span>
            {/* Glow ring */}
            <div
              className={`absolute inset-0 -m-3 rounded-full bg-gradient-to-br ${currentTier.color} opacity-40 blur-xl pointer-events-none`}
            />
          </div>

          {/* Tier name + level badge */}
          <h2 className="text-xl font-bold text-grape-800 mb-1">
            {currentTier.name}
          </h2>
          <span
            className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold text-white bg-gradient-to-r ${currentTier.color.replace(/to-[a-z]+-\d+/, 'to-grape-500').replace(/from-[a-z]+-\d+/, 'from-grape-400')}`}
            style={{
              background: 'linear-gradient(135deg, #9B7ED8, #7B5FB8)',
            }}
          >
            Lv.{currentTier.level}
          </span>

          {/* Total grapes */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <span className="text-2xl">{'\u{1F347}'}</span>
            <span className="text-3xl font-extrabold text-grape-700">
              {totalGrapes.toLocaleString()}
            </span>
            <span className="text-sm text-warm-sub self-end mb-1">포도알</span>
          </div>

          {/* Progress bar to next tier */}
          {nextTier ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-warm-sub mb-1.5">
                <span>{currentTier.icon} Lv.{currentTier.level}</span>
                <span>{nextTier.icon} Lv.{nextTier.level}</span>
              </div>
              <div className="w-full h-4 rounded-full bg-white/60 overflow-hidden shadow-inner relative">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-grape-400 via-grape-500 to-grape-600 transition-all duration-1000 ease-out relative"
                  style={{ width: `${tierProgress}%` }}
                >
                  {/* Animated shimmer on progress bar */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
              </div>
              <p className="text-xs text-warm-sub mt-2">
                다음 티어까지 <span className="font-bold text-grape-600">{grapesToNext.toLocaleString()}</span>포도알
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-grape-600 font-semibold">
                {'\u{1F451}'} 최고 등급 달성!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Wine Cellar Section ───────────────────────────── */}
      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-grape-700">
            <span className="mr-1">{'\u{1F377}'}</span>와인 셀러
          </h3>
          <span className="text-sm text-warm-sub font-medium">
            {bottles.length}병
          </span>
        </div>

        {bottles.length === 0 ? (
          /* Empty state */
          <div className="clay p-8 text-center">
            <div className="text-5xl mb-4 animate-float">{'\u{1F37E}'}</div>
            <p className="text-warm-sub text-sm leading-relaxed">
              아직 완성된 와인이 없어요.
              <br />
              포도판을 완성하면 와인이 만들어져요!
              <span className="ml-1">{'\u{1F347}'}</span>
            </p>
          </div>
        ) : (
          <>
            {/* Bottle grid */}
            <div className="clay p-5">
              {/* Cellar shelf decorative bar */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-800/20 to-transparent mb-4 rounded-full" />

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-6 gap-x-2 justify-items-center">
                {bottles.map((bottle) => (
                  <WineBottle
                    key={bottle.boardId}
                    bottle={bottle}
                    onClick={() =>
                      setSelectedBottle(
                        selectedBottle?.boardId === bottle.boardId ? null : bottle
                      )
                    }
                  />
                ))}
              </div>

              {/* Shelf line at bottom */}
              <div className="w-full h-1 bg-gradient-to-r from-amber-700/10 via-amber-800/30 to-amber-700/10 mt-5 rounded-full" />
            </div>

            {/* Selected bottle detail panel */}
            {selectedBottle && (
              <div className="clay-sm mt-3 p-5 bg-grape-50/60 animate-slide-up relative">
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
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-grape-500 to-grape-700 flex items-center justify-center text-2xl shadow-md">
                      {'\u{1F377}'}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4 className="text-base font-bold text-grape-800 mb-2 break-words">
                      {selectedBottle.title}
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
                    <p className="text-[11px] text-warm-light mt-2">
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
        <h3 className="text-lg font-bold text-grape-700 mb-4">
          <span className="mr-1">{'\u{1F5FA}\u{FE0F}'}</span>티어 로드맵
        </h3>

        <div className="clay p-5">
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[22px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-grape-300 via-grape-200 to-warm-border/30" />

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
                      ${isCurrent
                        ? 'bg-gradient-to-r from-grape-100/60 to-grape-50/40 shadow-sm'
                        : ''
                      }
                      ${isFuture ? 'opacity-40' : ''}
                    `}
                  >
                    {/* Node dot on the line */}
                    <div
                      className={`
                        relative z-10 w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0
                        ${isCurrent
                          ? 'bg-gradient-to-br from-grape-400 to-grape-600 shadow-lg ring-2 ring-grape-300 ring-offset-2'
                          : isPast
                            ? 'bg-gradient-to-br from-grape-200 to-grape-300 shadow-sm'
                            : 'bg-gray-100 shadow-sm'
                        }
                      `}
                    >
                      {isPast ? (
                        <span className="text-grape-700 text-sm font-bold">{'\u{2713}'}</span>
                      ) : (
                        <span>{tier.icon}</span>
                      )}
                    </div>

                    {/* Tier info */}
                    <div className="flex-1 min-w-0">
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
                      <span className={`text-xs ${isFuture ? 'text-warm-light' : 'text-warm-sub'}`}>
                        {tier.minGrapes === 0
                          ? '시작'
                          : `${tier.minGrapes.toLocaleString()}포도알 필요`}
                      </span>
                    </div>

                    {/* Level badge */}
                    <span
                      className={`text-xs font-bold flex-shrink-0 ${
                        isCurrent
                          ? 'text-grape-600'
                          : isPast
                            ? 'text-grape-400'
                            : 'text-warm-light'
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
      <span className="text-warm-light text-xs">{label}</span>
      <p className="text-grape-700 font-semibold text-sm">{value}</p>
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
