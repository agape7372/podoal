'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useCachedApi, readCachedApi, writeCachedApi } from '@/lib/cachedApi';
import SwipeableBoardCard, { SWIPE_TRANSITION } from '@/components/SwipeableBoardCard';
import StreakCard, { type StreakInfo } from '@/components/StreakCard';
import ClayButton from '@/components/ClayButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import OnboardingWelcome from '@/components/OnboardingWelcome';
import Avatar from '@/components/Avatar';
import NotificationBell from '@/components/NotificationBell';
import FriendActivityCard, { type CheerState } from '@/components/FriendActivityCard';
import Podo from '@/components/mascot/Podo';
import type { BoardSummary, BoardDetail } from '@/types';
import { feedbackTap, feedbackCheer } from '@/lib/feedback';
import { formatRelativeTime, type FriendActivity } from '@/lib/activity';

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '편안한 밤 보내세요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 14) return '점심은 드셨어요?';
  if (h < 18) return '오후도 화이팅이에요';
  if (h < 22) return '오늘 하루도 수고했어요';
  return '잘 자기 전 한 알 어때요';
}

type Filter = 'all' | 'active' | 'completed' | 'harvested';
const FILTERS: Filter[] = ['all', 'active', 'completed', 'harvested'];
const FILTER_KEY = 'podoal-home-filter'; // 마지막으로 본 필터 탭 기억(기기별)

const LIFT_MS = 450;   // 정지 후 이 시간 유지하면 카드를 들어 정렬 모드로
const MOVE_TOL = 10;   // 이만큼 움직이면 제스처 방향(스크롤/스와이프)을 확정
const TRAY_W = 144;    // 스와이프로 드러나는 액션 트레이 폭(px)

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  // SWR 캐시: 재방문 시 직전 보드 목록으로 즉시 렌더 + 무음 재검증.
  // (loadBoards/loadError 이름은 기존 호출처 호환을 위해 유지.)
  const {
    data: boardsData,
    loading,
    error: loadError,
    validated: boardsValidated,
    refresh: loadBoards,
    mutate: mutateBoards,
  } = useCachedApi<{ boards: BoardSummary[] }>('/api/boards');
  const boards = boardsData?.boards ?? [];
  const [filter, setFilter] = useState<Filter>('all');
  const greeting = useMemo(timeOfDayGreeting, []);

  // 정렬(드래그 리프트) + 스와이프 액션 상태.
  // 상태는 '임계 전이'(리프트 시작/종료, 축 잠금, 트레이 열림/닫힘)만 표현한다 —
  // 손가락을 따라가는 픽셀 오프셋은 setState가 아니라 ref + style.transform 직접
  // 조작으로 처리해 pointermove마다 리스트 전체가 리렌더되지 않게 한다.
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [swipeDragId, setSwipeDragId] = useState<string | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const ONBOARDED_KEY = 'podoal-onboarded';
  const dismissOnboarding = useCallback(() => {
    try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* noop */ }
    setShowOnboarding(false);
  }, []);

  // 가벼운 토스트 — 무음 실패(정렬 저장 실패)·비활성 동작 안내(미완성 보드 수확)에 사용.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const moveLayerRefs = useRef<Map<string, HTMLElement>>(new Map()); // 카드의 '움직이는 레이어'(transform 직접 조작 대상)
  const dragOrderRef = useRef<string[]>([]); // 드래그 중 보이는 카드 순서(클로저 staleness 회피)

  // 제스처 추적용 ref (렌더와 무관, 동기적 판정)
  const gStart = useRef<{ x: number; y: number } | null>(null);
  const gMoved = useRef(false);
  const gAxis = useRef<'x' | 'y' | null>(null);
  const gPointerId = useRef<number | null>(null);
  const gEl = useRef<HTMLElement | null>(null);
  const gLpTimer = useRef<number | null>(null);
  const gSwipeDx = useRef(0); // 라이브 스와이프 오프셋(리렌더 타이밍과 무관하게 onUp이 판정)

  // 보이는 보드의 상세 라우트를 미리 받아둔다 — board/[id]는 동적 라우트라
  // <Link> 없이는 카드 탭 시점에야 RSC 왕복이 시작돼 무반응 구간이 생긴다.
  // (카드 자체는 스와이프 제스처와 얽혀 있어 Link화 대신 명령형 프리페치를 쓴다.)
  useEffect(() => {
    boards.slice(0, 8).forEach((b) => router.prefetch(`/board/${b.id}`));
  }, [boards, router]);

  // 상세 '데이터'도 idle에 미리 받아 캐시 — 보드 카드 탭(이 앱의 최빈 전환)이
  // 첫 진입부터 API 대기 없이 즉시 렌더된다. 첫 페인트 버스트와 경쟁하지 않게
  // 1.5초 지연 + 순차 발사, 이미 캐시된 보드(직전에 봤던 것)는 건너뛴다.
  useEffect(() => {
    if (!boardsData) return;
    const targets = boardsData.boards.filter((b) => !b.harvestedAt).slice(0, 3);
    let cancelled = false;
    const t = window.setTimeout(async () => {
      for (const b of targets) {
        if (cancelled) return;
        if (readCachedApi(`/api/boards/${b.id}`)) continue;
        try {
          const d = await api<{ board: BoardDetail }>(`/api/boards/${b.id}`);
          writeCachedApi(`/api/boards/${b.id}`, d.board);
        } catch { /* 프리페치 실패는 조용히 무시 — 진입 시 정상 fetch가 커버 */ }
      }
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [boardsData]);

  // 스트릭 카드 데이터 — 보드 fetch와 병렬(독립 effect, 직렬 워터폴 금지).
  // mount 1회만 조회(stats API는 비용이 있어 잦은 refetch 금지).
  // 로딩 중엔 같은 높이의 스켈레톤으로 자리를 예약(늦게 끼어들며 콘텐츠가 점프하던 시프트 방지),
  // 실패 시에만 자리까지 조용히 접음 — 홈 핵심 흐름(보드 목록)엔 영향 없음.
  // SWR 캐시 — 통계 페이지와 같은 '/api/stats' 키 공유: 홈→통계 또는 그 반대로
  // 이동하면 어느 쪽도 다시 기다리지 않는다. 응답 전체가 캐시에 들어가므로
  // 여기선 스트릭 2필드만 뽑아 쓴다.
  const { data: statsData, error: streakFailed } =
    useCachedApi<{ stats: StreakInfo }>('/api/stats');
  const streakInfo: StreakInfo | null = statsData
    ? {
        currentStreak: statsData.stats.currentStreak,
        longestStreak: statsData.stats.longestStreak,
      }
    : null;

  // 첫 방문(보드 0개 + 미온보딩) 시 환영 온보딩 — "빈 홈에서 뭘 해야 하지?" 이탈 완화.
  // boardsValidated: 캐시의 빈 배열만 보고 서버 재검증 전에 오발하지 않게 확정값을 기다린다.
  useEffect(() => {
    if (loading || loadError || !boardsValidated || boards.length > 0) return;
    try {
      if (!localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);
    } catch { /* noop */ }
  }, [loading, loadError, boardsValidated, boards.length]);

  // 마지막으로 본 필터 탭 복원(재진입 시 항상 '전체'로 리셋되던 마찰 해소).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY);
      if (saved && (FILTERS as string[]).includes(saved)) setFilter(saved as Filter);
    } catch { /* localStorage 불가 환경 무시 */ }
  }, []);

  // order 우선, 없으면 createdAt 내림차순 폴백.
  const sortByOrder = (a: BoardSummary, b: BoardSummary) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.createdAt < b.createdAt ? 1 : -1;
  };

  const visible = boards.filter((b) => {
    if (filter === 'harvested') return !!b.harvestedAt;
    if (b.harvestedAt) return false; // 수확한 판은 다른 탭에서 숨김
    if (filter === 'active') return !b.isCompleted;
    if (filter === 'completed') return b.isCompleted;
    return true;
  });
  const displayBoards = [...visible].sort(sortByOrder);

  const allCount = boards.filter((b) => !b.harvestedAt).length;
  const activeCount = boards.filter((b) => !b.harvestedAt && !b.isCompleted).length;
  const completedCount = boards.filter((b) => !b.harvestedAt && b.isCompleted).length;
  const harvestedCount = boards.filter((b) => !!b.harvestedAt).length;

  const canReorder = filter === 'all'; // 정렬은 '전체'에서만(필터된 부분집합 정렬은 혼란)

  const clearLp = () => { if (gLpTimer.current) { window.clearTimeout(gLpTimer.current); gLpTimer.current = null; } };

  // 스와이프 중 카드 이동은 React를 거치지 않고 DOM에 직접 쓴다(리스트 리렌더 0회).
  // 제스처가 끝나면 같은 '정지 값'을 상태(swipeOpenId)로도 커밋해 선언적 스타일과 일치시킨다.
  const setCardX = (id: string, x: number, animate: boolean) => {
    const el = moveLayerRefs.current.get(id);
    if (!el) return;
    el.style.transition = animate ? SWIPE_TRANSITION : 'none';
    el.style.transform = `translateX(${x}px) scale(1)`;
  };

  // 보이는 카드만 재배열, 수확된 카드의 order는 보존. hit-test는 포인터 Y가 들어있는 행 1개를
  // 찾으므로 순서와 무관. 순서는 ref에 보관해 클로저 staleness를 피한다.
  const reorderMove = useCallback((clientY: number, draggingId: string) => {
    const ids = dragOrderRef.current;
    let overId: string | null = null;
    for (const id of ids) {
      const el = cardRefs.current.get(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) { overId = id; break; }
    }
    if (!overId || overId === draggingId) return;
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...ids];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    dragOrderRef.current = next;
    const orderMap = new Map(next.map((id, i) => [id, i] as const));
    mutateBoards((prev) =>
      prev && { ...prev, boards: prev.boards.map((b) => (orderMap.has(b.id) ? { ...b, order: orderMap.get(b.id)! } : b)) });
  }, [mutateBoards]);

  const persistOrder = useCallback(() => {
    const orderedIds = dragOrderRef.current;
    if (orderedIds.length === 0) return;
    // 실패를 조용히 삼키면 화면 순서와 서버 순서가 어긋난 채 재진입 시 슬그머니 원복됨 →
    // 사용자에게 알리고 서버 순서로 되돌린다.
    api('/api/boards/reorder', { method: 'PATCH', json: { orderedIds } }).catch(() => {
      showToast('순서를 저장하지 못했어요. 다시 시도해주세요.');
      loadBoards();
    });
  }, [showToast, loadBoards]);

  // 길게 눌러 카드를 들어올림 → 세로 드래그 정렬 모드 진입.
  const doLift = (board: BoardSummary) => {
    gLpTimer.current = null;
    if (!canReorder) return; // '전체' 탭에서만 정렬
    feedbackTap();
    setLiftedId(board.id);
    dragOrderRef.current = displayBoards.map((b) => b.id);
    const el = gEl.current;
    if (el && gPointerId.current != null) {
      el.style.touchAction = 'none'; // 즉시 스크롤 차단(리렌더 전)
      try { el.setPointerCapture(gPointerId.current); } catch { /* noop */ }
    }
  };

  const onDown = (e: React.PointerEvent, board: BoardSummary) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (swipeOpenId && swipeOpenId !== board.id) setSwipeOpenId(null); // 다른 카드 트레이 닫기
    gStart.current = { x: e.clientX, y: e.clientY };
    gMoved.current = false;
    gAxis.current = null;
    gPointerId.current = e.pointerId;
    gEl.current = e.currentTarget as HTMLElement;
    clearLp();
    gLpTimer.current = window.setTimeout(() => doLift(board), LIFT_MS);
  };

  const onMove = (e: React.PointerEvent, board: BoardSummary) => {
    if (liftedId === board.id) {
      e.preventDefault();
      reorderMove(e.clientY, board.id);
      return;
    }
    const st = gStart.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (gAxis.current === null) {
      if (Math.hypot(dx, dy) > MOVE_TOL) {
        clearLp();
        gMoved.current = true;
        gAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (gAxis.current === 'x') {
          setSwipeDragId(board.id);
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
        }
      }
    }
    if (gAxis.current === 'x') {
      e.preventDefault();
      const base = swipeOpenId === board.id ? -TRAY_W : 0;
      const next = Math.max(-TRAY_W, Math.min(0, base + dx));
      gSwipeDx.current = next;
      // pointermove마다 setState 금지 — transform 직접 조작(상태 전이는 onUp에서만).
      setCardX(board.id, next, false);
    }
  };

  const releaseCapture = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (gEl.current) gEl.current.style.touchAction = '';
  };

  const onUp = (e: React.PointerEvent, board: BoardSummary) => {
    clearLp();
    if (liftedId === board.id) {
      persistOrder();
      setLiftedId(null);
      dragOrderRef.current = [];
      releaseCapture(e);
      gStart.current = null;
      return;
    }
    if (gAxis.current === 'x') {
      const open = gSwipeDx.current <= -TRAY_W / 2;
      // 손을 뗀 지점 → 확정 위치 스냅백도 직접 조작으로 애니메이션한다.
      // (열림/닫힘이 기존 상태와 같으면 React가 transform을 다시 쓰지 않으므로
      //  이 수동 쓰기가 없으면 카드가 드래그 위치에 멈춘 채 남는다.)
      setCardX(board.id, open ? -TRAY_W : 0, true);
      setSwipeOpenId(open ? board.id : null);
      setSwipeDragId(null);
      gSwipeDx.current = 0;
      releaseCapture(e);
      gStart.current = null;
      return;
    }
    // 빠른 탭(이동·리프트 없음)
    if (!gMoved.current) {
      if (swipeOpenId === board.id) {
        setSwipeOpenId(null); // 열린 트레이는 탭으로 닫기
      } else {
        feedbackTap();
        router.push(`/board/${board.id}`);
      }
    }
    gStart.current = null;
  };

  const onCancel = (e: React.PointerEvent, board: BoardSummary) => {
    clearLp();
    if (liftedId === board.id) { setLiftedId(null); dragOrderRef.current = []; }
    // swipeDragId(state)는 축 잠금 직후 취소되면 아직 stale일 수 있어 ref로도 판정.
    if (gAxis.current === 'x' || swipeDragId === board.id) {
      setSwipeDragId(null);
      setCardX(board.id, swipeOpenId === board.id ? -TRAY_W : 0, true); // 직전 정지 위치로 복귀
      gSwipeDx.current = 0;
    }
    releaseCapture(e);
    gStart.current = null;
    gAxis.current = null;
  };

  // 카드의 '정지 상태' 오프셋만 상태로 표현한다(드래그 중 라이브 오프셋은 setCardX가 직접 씀).
  const offsetFor = (id: string) => {
    if (liftedId === id) return 0;
    if (swipeOpenId === id) return -TRAY_W;
    return 0;
  };

  const harvestBoard = async (board: BoardSummary) => {
    feedbackTap();
    setSwipeOpenId(null);
    const harvested = !board.harvestedAt;
    mutateBoards((prev) =>
      prev && { ...prev, boards: prev.boards.map((b) => (b.id === board.id ? { ...b, harvestedAt: harvested ? new Date().toISOString() : null } : b)) });
    try {
      await api(`/api/boards/${board.id}`, { method: 'PATCH', json: { harvested } });
    } catch {
      mutateBoards((prev) =>
        prev && { ...prev, boards: prev.boards.map((b) => (b.id === board.id ? { ...b, harvestedAt: harvested ? null : board.harvestedAt ?? null } : b)) });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
      mutateBoards((prev) => prev && { ...prev, boards: prev.boards.filter((b) => b.id !== id) });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  const setMoveLayerRef = (id: string) => (el: HTMLElement | null) => {
    if (el) moveLayerRefs.current.set(id, el);
    else moveLayerRefs.current.delete(id);
  };

  // ── 친구 소식 피드 (보드 목록 아래 독립 섹션) ──────────────────────────────
  // 홈 mount 시 1회, 보드 fetch와 병렬. 폴링/SSE 없음. 활동 0건이면 섹션 미렌더.
  // SWR 캐시: 재방문 시 직전 피드로 즉시 렌더 + 무음 재검증. 실패 시 섹션을 조용히 숨김(보조 정보).
  const { data: activityData } = useCachedApi<{ activities: FriendActivity[] }>('/api/activity/friends');
  const friendActivities = activityData?.activities ?? [];
  // 상대시간 기준 시각 — 렌더 중 현재시각 호출 금지(react-hooks/purity)라 데이터 도착 시점에 고정.
  const [activityFetchedAt, setActivityFetchedAt] = useState(0);
  useEffect(() => {
    if (activityData) setActivityFetchedAt(new Date().getTime());
  }, [activityData]);
  // 세션 내 동일 항목 재발송 차단(클라 상태) — 서버에는 레이트리밋이 별도로 있음.
  const [cheerStates, setCheerStates] = useState<Record<string, CheerState>>({});

  const sendCelebration = useCallback(async (activity: FriendActivity) => {
    feedbackTap();
    setCheerStates((prev) => ({ ...prev, [activity.boardId]: 'sending' }));
    try {
      // CheerModal과 동일한 요청 형태(POST /api/messages) — type만 celebration.
      await api('/api/messages', {
        method: 'POST',
        json: {
          receiverId: activity.actor.id,
          content: '포도판 완성 축하해요!',
          type: 'celebration',
          emoji: '🎉',
          boardId: activity.boardId,
        },
      });
      feedbackCheer();
      setCheerStates((prev) => ({ ...prev, [activity.boardId]: 'sent' }));
    } catch {
      setCheerStates((prev) => {
        const next = { ...prev };
        delete next[activity.boardId];
        return next;
      });
      showToast('축하를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }, [showToast]);

  return (
    <div className="pb-4">
      {/* Header — tap the avatar to open the profile sheet */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => { feedbackTap(); router.push('/profile'); }}
          aria-label="내 프로필"
          className="rounded-full shrink-0 active:scale-95 transition-transform"
        >
          <Avatar avatar={user?.avatar || 'grape'} size="lg" />
        </button>
        <div className="min-w-0 flex-1">
          {/* 인증이 병렬화돼 user가 잠깐 없을 수 있다 — "님"만 덩그러니 뜨지 않게 스켈레톤 폴백 */}
          {user ? (
            <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight text-warm-text truncate">
              {user.name}<span className="text-warm-sub font-normal text-[20px]">님</span>
            </h1>
          ) : (
            <div className="skeleton h-[30px] w-28 rounded-xl" aria-hidden="true" />
          )}
          <p className="text-xs leading-normal tracking-wide text-warm-sub mt-0.5">
            {greeting}
          </p>
        </div>
        <NotificationBell />
      </div>

      {/* 스트릭 카드 — 로딩 중엔 동일 높이 스켈레톤으로 자리 예약(레이아웃 시프트 방지), 필터 탭과 무관하게 항상 노출 */}
      {streakInfo
        ? <StreakCard streak={streakInfo} />
        : !streakFailed && <div className="skeleton h-[62px] mb-4 rounded-[28px]" aria-hidden="true" />}

      {/* Filter tabs — 한 줄(아이콘 없음): 전체/진행/완료/수확 + 카운트 */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {(['all', 'active', 'completed', 'harvested'] as const).map((f) => {
          const isActive = filter === f;
          const label = f === 'all' ? '전체' : f === 'active' ? '진행' : f === 'completed' ? '완료' : '수확';
          const count = f === 'all' ? allCount : f === 'active' ? activeCount : f === 'completed' ? completedCount : harvestedCount;
          return (
            <button
              key={f}
              onClick={() => {
                feedbackTap();
                setSwipeOpenId(null);
                setFilter(f);
                try { localStorage.setItem(FILTER_KEY, f); } catch { /* noop */ }
              }}
              aria-pressed={isActive}
              className={`
                shrink-0 px-3.5 py-2 rounded-2xl text-sm font-medium transition-all inline-flex items-center gap-1.5
                ${isActive ? 'clay-pressed text-grape-700' : 'clay-button text-warm-sub'}
              `}
            >
              {label}
              <span className={`font-display font-bold leading-none tabular-nums ${isActive ? 'text-grape-700' : 'text-warm-text'}`}>
                {loading ? <span className="inline-block w-3 h-3 rounded-full bg-warm-border/50 animate-pulse" /> : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Board list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">포도판을 불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <ClayButton variant="secondary" onClick={loadBoards}>다시 불러오기</ClayButton>
        </div>
      ) : displayBoards.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-5 flex justify-center">
            <Podo size={96} />
          </div>
          <p className="font-display text-base text-warm-text mb-1.5">
            {filter === 'all' ? '아직 포도판이 없어요' : filter === 'active' ? '진행중인 포도판이 없어요' : filter === 'completed' ? '완료한 포도판이 없어요' : '수확한 포도판이 없어요'}
          </p>
          {filter === 'all' && (
            <>
              <p className="text-sm text-warm-sub mb-5 text-balance">한 알씩 채워볼 첫 판을 만들어 보세요</p>
              <ClayButton variant="joyful" onClick={() => router.push('/board/create')}>
                포도판 만들기
              </ClayButton>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {displayBoards.map((board) => (
              <li key={board.id}>
                <SwipeableBoardCard
                  board={board}
                  offset={offsetFor(board.id)}
                  lifted={liftedId === board.id}
                  dragging={swipeDragId === board.id}
                  trayWidth={TRAY_W}
                  onHarvest={() => board.isCompleted ? harvestBoard(board) : showToast('포도판을 다 채우면 수확할 수 있어요')}
                  onDelete={() => { setSwipeOpenId(null); setDeleteTarget(board); }}
                  onOpen={() => { feedbackTap(); router.push(`/board/${board.id}`); }}
                  innerRef={setCardRef(board.id)}
                  moveLayerRef={setMoveLayerRef(board.id)}
                  pointerHandlers={{
                    onPointerDown: (e) => onDown(e, board),
                    onPointerMove: (e) => onMove(e, board),
                    onPointerUp: (e) => onUp(e, board),
                    onPointerCancel: (e) => onCancel(e, board),
                  }}
                />
              </li>
            ))}
          </ul>
          <p className="text-center text-[11px] text-warm-sub mt-4 text-balance">
            {canReorder ? '꾹 눌러 위아래로 정렬 · 옆으로 밀어 수확·삭제' : '카드를 옆으로 밀어 수확·삭제할 수 있어요'}
          </p>
        </>
      )}

      {/* 친구 소식 — 최근 7일 내 친구가 완성한 포도판. 활동 0건/친구 0명이면 통째로 숨김. */}
      {friendActivities.length > 0 && (
        <section className="mt-8" aria-label="친구 소식">
          <h2 className="font-display text-lg font-bold text-warm-text mb-3">친구 소식</h2>
          <ul className="space-y-2.5">
            {friendActivities.map((a) => (
              <li key={a.boardId}>
                <FriendActivityCard
                  activity={a}
                  timeText={formatRelativeTime(a.completedAt, activityFetchedAt)}
                  cheerState={cheerStates[a.boardId] ?? 'idle'}
                  onCheer={() => sendCelebration(a)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAB */}
      {boards.length > 0 && (
        <button
          onClick={() => { feedbackTap(); router.push('/board/create'); }}
          className="fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center text-3xl text-white bg-grape-600 border-[1.3px] border-warm-border active:translate-x-[1.5px] active:translate-y-[2px] transition-all z-40 safe-bottom"
          style={{ boxShadow: '2px 3px 0 rgba(73, 50, 100, 0.12)' }}
          aria-label="새 포도판 만들기"
        >
          +
        </button>
      )}

      {/* 가벼운 토스트 (정렬 저장 실패·미완성 수확 안내). 모달(z-90) 아래, 네비(z-50) 위. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-44 left-1/2 -translate-x-1/2 z-80 max-w-[88%] px-4 py-2.5 rounded-2xl clay-float bg-warm-text text-white text-sm font-medium text-center animate-fade-in"
        >
          {toast}
        </div>
      )}

      {/* 첫 방문 온보딩 환영 */}
      {showOnboarding && <OnboardingWelcome onClose={dismissOnboarding} />}

      {/* 삭제 확인 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="포도판을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요. 채운 포도알·보상도 모두 사라져요."
        confirmLabel="삭제"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
