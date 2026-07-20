'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCachedApi, readCachedApi, writeCachedApi } from '@/lib/cachedApi';
import {
  WINERY_TIERS,
  BOTTLE_SIZE_LABELS,
  type WineryTier,
  type WineBottle as WineBottleType,
} from '@/lib/winery';
import type { BoardDetail, BoardSummary } from '@/types';
import Link from 'next/link';
import WineBottle, { BOTTLE_BASELINE_H, BOTTLE_ROW_H } from '@/components/WineBottle';
import EmojiIcon from '@/components/EmojiIcon';
import EmptyState from '@/components/EmptyState';
import RetryButton from '@/components/RetryButton';
import Chevron from '@/components/Chevron';
import Confetti from '@/components/Confetti';
import { stripTitleEmoji } from '@/lib/title';
import { api } from '@/lib/api';
import { feedbackBottle, feedbackError, feedbackTap } from '@/lib/feedback';

// 마지막으로 본 티어 레벨(기기별) — 승급 감지용. zustand store 키는 동결
// 대상(podoal-app-settings)이라 스토어 밖 독립 키로 둔다.
const LAST_TIER_KEY = 'podoal-winery-last-tier';

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

// 티어 배지 아트 스캐폴드 — AI 배지 생성(docs/ILLUSTRATION_STYLE.md §B) 후 경로를
// 채우면 히어로(72px)·로드맵(24px)이 자동 채택하고, 비거나 로드 실패 시 EmojiIcon
// 폴백. 14px 진행 마커는 판독성 문제로 항상 EmojiIcon(교체 대상 아님).
// 2026-07-06 플랫 이모지 스타일 세트(z_image·라운드 타일)로 채움 — docs/ILLUSTRATION_STYLE.md 대장 참조.
const TIER_ART: Record<number, string> = {
  1: '/illustrations/tiers/tier-1-v2.webp',
  2: '/illustrations/tiers/tier-2-v2.webp',
  3: '/illustrations/tiers/tier-3-v2.webp',
  4: '/illustrations/tiers/tier-4-v2.webp',
  5: '/illustrations/tiers/tier-5-v2.webp',
  6: '/illustrations/tiers/tier-6-v2.webp',
  7: '/illustrations/tiers/tier-7-v2.webp',
};

// 티어 아이콘 단일 렌더러 — TIER_ART 유무/실패에 따라 아트 ↔ EmojiIcon 전환.
function TierBadge({
  level,
  icon,
  size,
  label,
  className,
}: {
  level: number;
  icon: string;
  size: number;
  label?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const art = TIER_ART[level];
  if (!art || failed) {
    return <EmojiIcon emoji={icon} size={size} label={label} className={className} />;
  }
  return (
    <img
      src={art}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

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
  // 선택은 id만 상태로, 패널 데이터는 bottles에서 파생 — SWR 재검증 후에도
  // 패널이 신선하고(객체 스냅샷 고착 해소), 병이 응답에서 사라지면 자동 닫힘.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  // 전 병에 공유되는 안정 콜백 — WineBottle memo가 선택 토글 리렌더를 N→2로.
  const handleSelectBottle = useCallback((boardId: string) => {
    setSelectedId((prev) => (prev === boardId ? null : boardId));
  }, []);
  // 연도 선반 펼침 상태 — null = 기본(최신 연도만 펼침).
  const [openYears, setOpenYears] = useState<string[] | null>(null);

  // ─── 수확(셀러 입고) 의식 ───────────────────────────────
  // 홈의 수확 스와이프와 동일한 서버 상태(PATCH {harvested}) — 신규 쓰기 API 0.
  // 성공 시 feedbackBottle(승급과 함께 이 사운드의 전용 용도) + 재검증으로
  // NEW 스탬프 소거. 홈 목록에서도 수확 탭으로 이동(기존 의미 그대로).
  const [harvesting, setHarvesting] = useState(false);
  const [harvestError, setHarvestError] = useState('');

  // ─── 소믈리에 노트 ──────────────────────────────────────
  // 완성 습관 회고 메모 — 같은 PATCH 라우트의 cellarNote 분기(완성 보드 한정).
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const saveNote = async (boardId: string) => {
    if (noteSaving) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      await api(`/api/boards/${boardId}`, { method: 'PATCH', json: { cellarNote: noteDraft } });
      setNoteEditing(false);
      refresh();
    } catch {
      feedbackError();
      setNoteError('노트를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setNoteSaving(false);
    }
  };
  // 다른 병을 선택하면 진행 중이던 노트 편집·오류를 초기화.
  useEffect(() => {
    setNoteEditing(false);
    setNoteError('');
    setHarvestError('');
  }, [selectedId]);
  const handleHarvest = async (boardId: string) => {
    if (harvesting) return;
    feedbackTap();
    setHarvesting(true);
    setHarvestError('');
    try {
      await api(`/api/boards/${boardId}`, { method: 'PATCH', json: { harvested: true } });
      feedbackBottle();
      // 정합 버그 수정(2026-07-19): PATCH 응답이 {ok:true}뿐이라 harvestedAt을 직접
      // 못 받으므로 지금 시각으로 write-through. 이걸 빼면 refresh()는 이 화면의
      // '/api/winery'만 재검증하고, 홈이 읽는 '/api/boards' 리스트(탭 카운트·수확
      // 배지·스와이프 트레이 게이트)와 '/api/boards/{id}' 상세는 5초 TTL 동안 미수확
      // 상태로 고착 — 그 창에서 홈 스와이프를 다시 하면 서버 harvestedAt이 리셋된다.
      // board/[id]/page.tsx의 syncBoardCaches와 같은 패턴(참고만, 그쪽은 미수정).
      const harvestedAt = new Date().toISOString();
      const home = readCachedApi<{ boards: BoardSummary[] }>('/api/boards');
      if (home?.boards.some((b) => b.id === boardId)) {
        writeCachedApi('/api/boards', {
          ...home,
          boards: home.boards.map((b) => (b.id === boardId ? { ...b, harvestedAt } : b)),
        });
      }
      const detail = readCachedApi<BoardDetail>(`/api/boards/${boardId}`);
      if (detail) {
        writeCachedApi(`/api/boards/${boardId}`, { ...detail, harvestedAt });
      }
      refresh();
    } catch {
      feedbackError();
      setHarvestError('수확에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setHarvesting(false);
    }
  };

  // ─── 티어 승급 셀레브레이션 ─────────────────────────────
  // localStorage의 마지막 본 티어와 비교해 올라갔을 때만 1회 발화.
  // 첫 방문(저장값 없음)은 조용히 기록만 — 소급 축하 폭탄 방지.
  // 다중 레벨 점프는 최종 티어에서 1회만.
  const [tierPop, setTierPop] = useState(0); // n>0 = n번째 연출(링 리마운트 키)
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const celebratedRef = useRef(false); // SWR 재검증마다 effect가 다시 돌아도 세션 1회
  const tierIconRef = useRef<HTMLDivElement>(null);
  const tierRingRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) return;
    const level = data.currentTier.level;
    let stored: number | null = null;
    try {
      const raw = localStorage.getItem(LAST_TIER_KEY);
      stored = raw === null ? null : parseInt(raw, 10);
    } catch {
      return; // storage 접근 불가(프라이빗 모드 등) — 연출 없이 정상 렌더
    }
    if (stored === null || Number.isNaN(stored)) {
      try { localStorage.setItem(LAST_TIER_KEY, String(level)); } catch {}
      return;
    }
    if (level <= stored) {
      // 하향(데이터 보정)도 동기화해 다음 실제 승급이 정확히 감지되게 한다.
      if (level < stored) {
        try { localStorage.setItem(LAST_TIER_KEY, String(level)); } catch {}
      }
      return;
    }
    try { localStorage.setItem(LAST_TIER_KEY, String(level)); } catch {}
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    setTierPop((p) => p + 1);
  }, [data]);

  // 연출 시퀀스 — GrapeBoard 관례: React 노드엔 WAAPI만(클래스 불변),
  // transform/opacity 한정, 장식 노드 aria-hidden, cleanup으로 선제 정리.
  // WAAPI는 globals.css의 전역 reduced-motion 백스톱 밖이라 직접 가드.
  useEffect(() => {
    if (tierPop === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anims: Animation[] = [];
    if (!reduced) {
      if (tierIconRef.current) {
        anims.push(tierIconRef.current.animate(
          [
            { transform: 'scale(1) rotate(0deg)' },
            { transform: 'scale(1.16) rotate(-4deg)', offset: 0.35 },
            { transform: 'scale(1)' },
          ],
          { duration: 700, easing: 'cubic-bezier(.34,1.56,.64,1)' },
        ));
      }
      if (tierRingRef.current) {
        anims.push(tierRingRef.current.animate(
          [
            { opacity: 0.75, transform: 'scale(0.7)' },
            { opacity: 0, transform: 'scale(1.7)' },
          ],
          { duration: 900, easing: 'ease-out' },
        ));
      }
      if (progressFillRef.current) {
        // 암시적 to-keyframe: scaleX(0)에서 요소의 현재 값(정지 상태의
        // scaleX(tierProgress/100))으로 — 승급 직후 풀바로 튀지 않는다.
        anims.push(progressFillRef.current.animate(
          [{ transform: 'scaleX(0)' }],
          { duration: 900, delay: 250, easing: 'ease-out', fill: 'backwards' },
        ));
      }
    }
    // 박자: 아이콘 팝 정점에서 사운드+햅틱(feedbackBottle 첫 소생)과 컨페티 동시.
    // reduced여도 발화 — 컨페티의 CSS 애니는 전역 백스톱이 담당한다.
    const beat = setTimeout(() => {
      feedbackBottle();
      setConfettiTrigger((t) => t + 1);
    }, 350);
    return () => {
      anims.forEach((a) => a.cancel());
      clearTimeout(beat);
    };
  }, [tierPop]);

  // Bring the detail panel into view when a bottle is selected (it opens below
  // the cellar, which can sit off-screen in a tall cellar).
  useEffect(() => {
    if (selectedId) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

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
          <RetryButton onRetry={refresh} />
        </div>
      </div>
    );
  }

  const { totalGrapes, currentTier, nextTier, tierProgress, bottles } = data;
  const grapesToNext = nextTier ? nextTier.minGrapes - totalGrapes : 0;
  // 파생 선택 — find 실패(재검증으로 병 소실)면 null = 패널 자동 닫힘.
  const selectedBottle = selectedId
    ? bottles.find((b) => b.boardId === selectedId) ?? null
    : null;

  // ─── 빈티지 연도 선반 그룹핑 ────────────────────────────
  // bottles는 completedAt desc라 연도가 연속 — O(n) 단일 패스로 그룹.
  // 연도가 2개 이상일 때만 헤더 노출(신규 유저 화면은 현행과 동일).
  // 접힌 연도는 병 DOM 자체를 만들지 않는다 — content-visibility보다 근본적,
  // 병 수백 개에서도 초기 커밋 억제(가상화 불필요).
  const bottlesByYear: Array<{ year: string; items: WineBottleType[] }> = [];
  for (const b of bottles) {
    const last = bottlesByYear[bottlesByYear.length - 1];
    if (last && last.year === b.vintage) last.items.push(b);
    else bottlesByYear.push({ year: b.vintage, items: [b] });
  }
  const multiYear = bottlesByYear.length > 1;
  // null = 기본값(최신 연도만 펼침). 사용자가 토글하면 배열로 승격.
  const expandedYears = openYears ?? (bottlesByYear.length > 0 ? [bottlesByYear[0].year] : []);
  const toggleYear = (year: string) => {
    feedbackTap();
    setOpenYears(
      expandedYears.includes(year)
        ? expandedYears.filter((y) => y !== year)
        : [...expandedYears, year],
    );
  };

  // Wooden shelf plank drawn at the shared bottle baseline, repeated once per row.
  const shelfPitch = BOTTLE_ROW_H + 24; // cell height + gap-y-6
  const cellarShelf = `repeating-linear-gradient(to bottom, transparent 0 ${BOTTLE_BASELINE_H}px, rgba(146,100,56,0.30) ${BOTTLE_BASELINE_H}px ${BOTTLE_BASELINE_H + 4}px, rgba(83,55,28,0.16) ${BOTTLE_BASELINE_H + 4}px ${BOTTLE_BASELINE_H + 7}px, transparent ${BOTTLE_BASELINE_H + 7}px ${shelfPitch}px)`;

  return (
    <div className="pb-4">
      {/* 승급 셀레브레이션 컨페티 (trigger 카운터 관례) */}
      <Confetti trigger={confettiTrigger} />
      {/* 스크린리더용 승급 안내 — 시각 연출의 비시각 짝 */}
      {tierPop > 0 && (
        <p role="status" className="sr-only">{currentTier.name} 티어로 승급했어요</p>
      )}

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
          <div ref={tierIconRef} className="relative inline-block mb-3">
            <TierBadge
              level={currentTier.level}
              icon={currentTier.icon}
              size={72}
              label={currentTier.name}
              className="block animate-float mx-auto"
            />
            {/* Glow ring — TIER_GLOW 참조(위와 동일 사유) */}
            <div
              className={`absolute inset-0 -m-3 rounded-full bg-linear-to-br ${TIER_GLOW[currentTier.level]} opacity-40 blur-xl pointer-events-none`}
            />
            {/* 승급 링 버스트 — WAAPI 전용(초기 opacity 0, 연출 후 자연 소멸).
                key로 승급마다 리마운트해 재발화 잔상 없이 초기화. */}
            {tierPop > 0 && (
              <div
                key={tierPop}
                ref={tierRingRef}
                aria-hidden
                className={`absolute inset-0 -m-3 rounded-full bg-linear-to-br ${TIER_GLOW[currentTier.level]} pointer-events-none`}
                style={{ opacity: 0 }}
              />
            )}
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
                  ref={progressFillRef}
                  // width 대신 scaleX(컴포지터 전용) — 승급 WAAPI(위 effect)는 암시적
                  // to-keyframe으로 이 정지 상태(scaleX(tierProgress/100))에 수렴한다.
                  className="h-full w-full rounded-full bg-linear-to-r from-grape-400 via-grape-500 to-grape-600 transition-transform duration-1000 ease-out relative"
                  style={{ transform: `scaleX(${tierProgress / 100})`, transformOrigin: 'left' }}
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
          /* Empty state — 첫 와인을 기다리는 빈 선반. 인라인 🍇는 fallbackEmoji로 승격,
             clay 카드 표면은 px-8로 보존(수직 여백은 EmptyState의 py-12가 담당). */
          <div className="clay px-8">
            <EmptyState
              art="/illustrations/empty/empty-winery-v2.webp"
              fallbackEmoji="🍇"
              title="아직 완성된 와인이 없어요."
              description="포도판을 완성하면 와인이 만들어져요!"
            >
              <Link
                href="/home"
                className="clay-button inline-block px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700"
              >
                포도판 채우러 가기
              </Link>
            </EmptyState>
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
              {multiYear ? (
                /* 연도별 선반 — 선반 배경은 반드시 연도 그리드 각각에 적용
                   (전역 1장이면 헤더 높이만큼 선반선이 어긋난다). */
                <div className="space-y-4">
                  {bottlesByYear.map(({ year, items }) => {
                    const open = expandedYears.includes(year);
                    return (
                      <div key={year}>
                        <button
                          onClick={() => toggleYear(year)}
                          aria-expanded={open}
                          className="w-full flex items-center gap-2.5 py-1.5 px-1"
                        >
                          <span className="pastel-stamp text-xs tabular-nums">{year}</span>
                          <span className="text-xs text-warm-sub font-medium tabular-nums">
                            {items.length}병
                          </span>
                          <span
                            className={`ml-auto transition-transform duration-300 ${open ? 'rotate-90' : ''}`}
                          >
                            <Chevron size={16} />
                          </span>
                        </button>
                        {/* 접힌 연도는 병 DOM 미생성 — 초기 커밋 억제 */}
                        {open && (
                          <div
                            className="grid grid-cols-3 sm:grid-cols-4 gap-y-6 gap-x-2 justify-items-center mt-2"
                            style={{ backgroundImage: cellarShelf }}
                          >
                            {items.map((bottle) => (
                              <WineBottle
                                key={bottle.boardId}
                                bottle={bottle}
                                selected={selectedId === bottle.boardId}
                                onSelect={handleSelectBottle}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="grid grid-cols-3 sm:grid-cols-4 gap-y-6 gap-x-2 justify-items-center"
                  style={{ backgroundImage: cellarShelf }}
                >
                  {bottles.map((bottle) => (
                    <WineBottle
                      key={bottle.boardId}
                      bottle={bottle}
                      selected={selectedId === bottle.boardId}
                      onSelect={handleSelectBottle}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Selected bottle detail panel — 실제 와인 라벨처럼(texture-paper +
                빈티지 스탬프 + font-display), 막다른 골목이던 패널에 보드 회고
                출구 추가(완성 보드의 보상·타임캡슐·공유가 링크 1개로 열림). */}
            {selectedBottle && (
              <div ref={detailRef} className="clay-sm mt-3 p-5 texture-paper bg-clay-cream animate-slide-up relative">
                {/* Close button */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-warm-sub hover:bg-white hover:text-grape-600 transition-colors text-sm z-10"
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
                    {/* 빈티지 스탬프 + Title */}
                    <span className="pastel-stamp text-[11px] tabular-nums mb-2">
                      {selectedBottle.vintage} 빈티지
                    </span>
                    <h4 className="font-display text-base font-bold text-grape-800 mt-1.5 mb-2 wrap-break-word">
                      {stripTitleEmoji(selectedBottle.title)}
                    </h4>

                    {/* Detail grid — 빈티지는 스탬프로 승격, 자리는 완성일로 */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                      <DetailRow
                        label="완성일"
                        value={formatDate(selectedBottle.completedAt)}
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

                    {/* 소믈리에 노트 — 라벨 위에 쓰는 회고 메모 */}
                    {noteEditing ? (
                      <div className="mt-3">
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          maxLength={200}
                          rows={3}
                          aria-label="소믈리에 노트"
                          placeholder="이 습관을 완성하고 느낀 점을 남겨보세요"
                          className="clay-input w-full resize-none"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => saveNote(selectedBottle.boardId)}
                            disabled={noteSaving}
                            className="clay-button px-3.5 py-1.5 rounded-xl text-xs font-semibold text-grape-700 disabled:opacity-60"
                          >
                            {noteSaving ? '저장 중…' : '저장'}
                          </button>
                          <button
                            onClick={() => { feedbackTap(); setNoteEditing(false); setNoteError(''); }}
                            disabled={noteSaving}
                            className="px-3 py-1.5 text-xs text-warm-sub"
                          >
                            취소
                          </button>
                          <span className="ml-auto text-[11px] text-warm-sub tabular-nums">
                            {noteDraft.length}/200
                          </span>
                        </div>
                      </div>
                    ) : selectedBottle.cellarNote ? (
                      <div className="mt-3">
                        <p className="text-xs text-warm-sub mb-0.5">소믈리에 노트</p>
                        <p className="text-sm text-warm-text leading-relaxed wrap-break-word">
                          {selectedBottle.cellarNote}
                        </p>
                        <button
                          onClick={() => { feedbackTap(); setNoteDraft(selectedBottle.cellarNote ?? ''); setNoteEditing(true); }}
                          className="text-xs text-grape-600 font-semibold mt-1"
                        >
                          수정
                        </button>
                      </div>
                    ) : selectedBottle.cellarNote === null ? (
                      /* 구캐시(undefined)엔 미노출 — 재검증 후 등장 */
                      <button
                        onClick={() => { feedbackTap(); setNoteDraft(''); setNoteEditing(true); }}
                        className="block text-xs text-grape-600 font-semibold mt-3"
                      >
                        + 소믈리에 노트 남기기
                      </button>
                    ) : null}

                    {noteError && (
                      <p role="alert" className="text-rose-700 text-xs mt-2">{noteError}</p>
                    )}
                    {harvestError && (
                      <p role="alert" className="text-rose-700 text-xs mt-3">{harvestError}</p>
                    )}

                    {/* 회고 출구 + 수확(입고) 의식 — 미수확 병만 수확 버튼 노출 */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Link
                        href={`/board/${selectedBottle.boardId}`}
                        className="clay-button inline-block px-4 py-2 rounded-2xl text-sm font-semibold text-grape-700"
                      >
                        포도판 다시 보기
                      </Link>
                      {selectedBottle.harvestedAt === null && (
                        <button
                          onClick={() => handleHarvest(selectedBottle.boardId)}
                          disabled={harvesting}
                          className="clay-button px-4 py-2 rounded-2xl text-sm font-semibold text-leaf-700 disabled:opacity-60"
                        >
                          {harvesting ? '수확하는 중…' : '수확하기'}
                        </button>
                      )}
                    </div>
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
                      relative flex items-center gap-3 py-3 px-3 rounded-2xl transition-[box-shadow,opacity] duration-300
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
                        <TierBadge level={tier.level} icon={tier.icon} size={24} />
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
