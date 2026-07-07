'use client';

import { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
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
import EmptyState from '@/components/EmptyState';
import type { BoardSummary, BoardDetail } from '@/types';
import { feedbackTap, feedbackCheer } from '@/lib/feedback';
import { formatRelativeTime, type FriendActivity } from '@/lib/activity';
import { arrayMove, computeTargetIndex, clampLiftDy, shiftFor, rowFootprint, inferRowGap, edgeScrollVelocity, type SlotSnapshot } from '@/lib/reorder';

// order 우선, 없으면 createdAt 내림차순 폴백. 외부 클로저 의존이 없어 모듈 레벨에
// 둔다 — 컴포넌트 내 함수면 매 렌더 새 참조라 displayBoards useMemo를 매번 무효화한다.
function sortByOrder(a: BoardSummary, b: BoardSummary): number {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.createdAt < b.createdAt ? 1 : -1;
}

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
const TRAY_W = 120;    // 스와이프 슬라이드 거리(px) — 버튼은 88px 고정, 나머지는 여백(손맛)
// 풀스와이프 즉시 수확(완성 보드 전용): 카드폭 대비 비율. 클램프(더 못 끌게 막는 지점)를
// 커밋 임계보다 넓게 둬 '넘겼다'는 감각이 확실히 남는다. 미완성 보드는 기존 -TRAY_W 클램프.
const FULL_CLAMP_FRAC = 0.55;
const FULL_COMMIT_FRAC = 0.45;
const REORDER_TRANSITION = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'; // 이웃 비켜주기·드롭 정착(FLIP) 공통 이징
const EDGE_ZONE = 96;       // 화면 위/아래 이 영역(px)에 손가락이 들어오면 자동 스크롤 시작
const EDGE_MAX_SPEED = 16;  // 엣지 최내곽에서의 자동 스크롤 속도(px/frame)
const NAV_INSET = 80;       // 하단 고정 네비/홈인디케이터가 가리는 높이 — 아래 트리거를 그 위로 올린다

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
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
  // 참조 안정화: `?? []`가 매 렌더 새 빈 배열을 만들면 boards에 의존하는 memo/effect가
  // 전부 무효화된다. 데이터가 같으면 같은 배열을 유지한다.
  const boards = useMemo(() => boardsData?.boards ?? [], [boardsData?.boards]);
  const [filter, setFilter] = useState<Filter>('all');
  // 렌더마다 계산(매우 저렴) — 앱을 오래 켜둬도 시간대가 바뀌면 인사말이 따라간다.
  const greeting = timeOfDayGreeting();

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
  const moveLayerRefs = useRef<Map<string, HTMLElement>>(new Map()); // 카드의 '움직이는 레이어'(가로 스와이프 transform 대상)

  // 정렬 드래그(롱프레스 후): 드래그 중 React 리렌더 0회(스와이프와 동일 철학).
  // 손가락 추적/이웃 비켜주기는 outer 요소(cardRefs)에 transform 직접 기록하고,
  // 행 순서는 손을 뗄 때 endLift에서 한 번만 커밋한다.
  const liftRef = useRef<{
    id: string;
    ids: string[];       // 리프트 시점 표시 순서(고정 스냅샷)
    snap: SlotSnapshot;  // 각 행 outer의 top/height(정적)
    source: number;      // 드래그 행의 시작 인덱스
    target: number;      // 현재 삽입 인덱스
    footprint: number;   // 드래그 행 높이 + 행 간격
    startY: number;      // 리프트 순간의 포인터 clientY
    scrollY0: number;    // 리프트 순간의 window.scrollY — 자동 스크롤 중 dy 보정 기준
  } | null>(null);
  const flipRef = useRef<Map<string, number> | null>(null); // FLIP First: 커밋 직전 각 행의 화면상 top
  const flipAbortRef = useRef<AbortController | null>(null); // FLIP 정착 transitionend 리스너 수명 관리(중단/언마운트 시 일괄 제거)
  const gLastY = useRef(0); // 최신 포인터 clientY(리프트는 이벤트 없이 타이머로 발화 → startY 확보용)

  // 제스처 추적용 ref (렌더와 무관, 동기적 판정)
  const gStart = useRef<{ x: number; y: number } | null>(null);
  const gMoved = useRef(false);
  const gAxis = useRef<'x' | 'y' | null>(null);
  const gPointerId = useRef<number | null>(null);
  const gEl = useRef<HTMLElement | null>(null);
  const gLpTimer = useRef<number | null>(null);
  const gSwipeDx = useRef(0); // 라이브 스와이프 오프셋(리렌더 타이밍과 무관하게 onUp이 판정)
  const gCardW = useRef(0); // 축잠금 시점의 카드폭 — 풀스와이프 임계(비율) 환산용
  const gCommitArmed = useRef(false); // 풀스와이프 커밋 임계 통과 상태(햅틱 1회·트레이 강조 토글)
  const gSwipeBase = useRef(0); // x축 잠금 시점의 누적 dx — y→x 늦은 승격 시 카드가 점프하지 않게 기준점 재설정

  // 리프트 중 네이티브 스크롤 차단 — touch-action은 터치 '접촉 시점'에 고정되므로
  // doLift의 늦은 'none' 설정은 진행 중인 터치에 무효. 유일한 수단은 non-passive
  // touchmove의 preventDefault(리프트 시점엔 손가락이 슬롭 안이라 네이티브 팬 시작 전).
  // 해제가 누수되면 페이지 스크롤 전체가 죽는다 — onUp·onCancel(releaseCapture 경유)·
  // effect cleanup 3중으로 해제를 보장한다.
  const touchBlocker = useRef<((ev: TouchEvent) => void) | null>(null);
  const unblockNativeScroll = useCallback(() => {
    if (!touchBlocker.current) return;
    document.removeEventListener('touchmove', touchBlocker.current);
    touchBlocker.current = null;
  }, []);
  const blockNativeScroll = useCallback(() => {
    if (touchBlocker.current) return;
    const block = (ev: TouchEvent) => { if (ev.cancelable) ev.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    touchBlocker.current = block;
  }, []);
  useEffect(() => unblockNativeScroll, [unblockNativeScroll]);

  // 리프트 중 화면 가장자리 자동 스크롤 — rAF 핸들(루프가 살아 있으면 non-null).
  // 네이티브 팬은 blockNativeScroll이 막아두므로, 가장자리 스크롤은 전적으로 이 루프가 담당한다.
  const autoScrollRaf = useRef<number | null>(null);
  const orientAbortRef = useRef<AbortController | null>(null); // 드래그 중 회전 감지 리스너 수명
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current != null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  }, []);
  useEffect(() => stopAutoScroll, [stopAutoScroll]); // 언마운트 시 루프 누수 방지
  useEffect(() => () => orientAbortRef.current?.abort(), []); // 언마운트 시 회전 리스너 제거

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


  // 필터·정렬·카운트는 boards/filter에만 의존 — 홈은 제스처/토스트/모달 등 보드와
  // 무관한 로컬 state 변화가 잦아, memo 없으면 매 렌더에서 5회 filter+sort를 다시 돈다.
  const displayBoards = useMemo(() => {
    const visible = boards.filter((b) => {
      if (filter === 'harvested') return !!b.harvestedAt;
      if (b.harvestedAt) return false; // 수확한 판은 다른 탭에서 숨김
      if (filter === 'active') return !b.isCompleted;
      if (filter === 'completed') return b.isCompleted;
      return true;
    });
    return [...visible].sort(sortByOrder);
  }, [boards, filter]);

  const { allCount, activeCount, completedCount, harvestedCount } = useMemo(() => {
    let all = 0, active = 0, completed = 0, harvested = 0;
    for (const b of boards) {
      if (b.harvestedAt) { harvested++; continue; }
      all++;
      if (b.isCompleted) completed++; else active++;
    }
    return { allCount: all, activeCount: active, completedCount: completed, harvestedCount: harvested };
  }, [boards]);

  const canReorder = filter === 'all'; // 정렬은 '전체'에서만(필터된 부분집합 정렬은 혼란)

  const clearLp = () => { if (gLpTimer.current) { window.clearTimeout(gLpTimer.current); gLpTimer.current = null; } };

  // 리프트 드래그의 손가락 추적 + 이웃 비켜주기를 한 곳으로. onMove(손가락 이동)와 자동
  // 스크롤 틱(손가락 정지 중 스크롤만 진행)이 똑같이 호출한다. dy는 뷰포트 기준 포인터
  // 이동(clientY-startY)에 그동안의 스크롤 이동(scrollY-scrollY0)을 더해 보정한다 —
  // snap.tops가 리프트 시점 뷰포트 좌표라, 이 보정이 없으면 자동 스크롤 후 삽입 위치와
  // 이웃 배치가 어긋난다.
  const applyLiftMove = useCallback((clientY: number) => {
    const L = liftRef.current;
    if (!L) return;
    // 손가락 추적값(스크롤 보정 포함)을 목록 범위로 클램프 — 카드가 헤더/여백으로 날아가
    // 큰 빈 공간을 만들지 않게(드롭 가능 범위는 첫~마지막 슬롯까지다).
    const dy = clampLiftDy(L.snap, L.source, (clientY - L.startY) + (window.scrollY - L.scrollY0));
    const draggedEl = cardRefs.current.get(L.id);
    if (draggedEl) {
      draggedEl.style.transition = 'none';
      draggedEl.style.transform = `translateY(${dy}px)`;
    }
    const target = computeTargetIndex(L.snap, L.source, dy);
    if (target !== L.target) {
      L.target = target;
      for (let i = 0; i < L.ids.length; i++) {
        if (i === L.source) continue;
        const el = cardRefs.current.get(L.ids[i]);
        if (!el) continue;
        const shift = shiftFor(i, L.source, target, L.footprint);
        el.style.transition = REORDER_TRANSITION;
        el.style.transform = shift ? `translateY(${shift}px)` : 'translateY(0)';
      }
    }
  }, []);

  // 자동 스크롤 한 틱. 손가락이 엣지존을 벗어나면(속도 0) 스스로 멈춘다. 엣지 안이면
  // 속도만큼 페이지를 굴리고, 그 즉시 같은 손가락 위치로 드래그를 재계산해(스크롤로 dy가
  // 바뀌므로) 카드·이웃이 스크롤을 따라가게 한다. 문서 양 끝에 닿으면 더 굴리지 않는다.
  const autoScrollTick = useCallback(() => {
    // 자기참조 rAF 루프는 지역 함수로 — useCallback이 자신을 재예약하면 stale 클로저가
    // 돈다. 시작만 useCallback이 맡고, self-schedule은 안정적인 지역 tick이 담당한다.
    const tick = () => {
      if (!liftRef.current) { autoScrollRaf.current = null; return; }
      const vh = window.innerHeight;
      const v = edgeScrollVelocity(gLastY.current, vh - NAV_INSET, EDGE_ZONE, EDGE_MAX_SPEED);
      if (v === 0) { autoScrollRaf.current = null; return; }
      const maxY = document.documentElement.scrollHeight - vh;
      const nextY = Math.max(0, Math.min(maxY, window.scrollY + v));
      // 문서 끝에 닿아 더 굴릴 곳이 없으면 헛도는 rAF를 멈춘다(매 프레임 noop 방지).
      // 손가락이 다시 움직이면 onMove가 루프를 깨운다.
      if (nextY === window.scrollY) { autoScrollRaf.current = null; return; }
      window.scrollTo(0, nextY);
      applyLiftMove(gLastY.current);
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    tick();
  }, [applyLiftMove]);

  // 스와이프 중 카드 이동은 React를 거치지 않고 DOM에 직접 쓴다(리스트 리렌더 0회).
  // 제스처가 끝나면 같은 '정지 값'을 상태(swipeOpenId)로도 커밋해 선언적 스타일과 일치시킨다.
  const setCardX = (id: string, x: number, animate: boolean) => {
    const el = moveLayerRefs.current.get(id);
    if (!el) return;
    el.style.transition = animate ? SWIPE_TRANSITION : 'none';
    el.style.transform = `translateX(${x}px) scale(1)`;
    // 풀스와이프로 카드가 TRAY_W 너머까지 밀리면 트레이를 노출 폭만큼 넓힌다(우측 고정이라
    // 왼쪽으로 확장, 버튼은 justify-center로 따라옴). React는 같은 prop 값을 다시 쓰지
    // 않으므로 이 직접 쓰기는 재렌더에 안 지워진다 — 모든 정지/스냅 경로가 이 함수를
    // 지나기에 여기서 항상 일관 값(-x와 TRAY_W 중 큰 쪽)으로 복원된다.
    const tray = el.parentElement?.querySelector<HTMLElement>('[data-tray]');
    if (tray) tray.style.width = `${Math.max(TRAY_W, -x)}px`;
  };

  // 풀스와이프 커밋 임계 통과 강조 — 트레이에 data-commit을 토글하면
  // SwipeableBoardCard의 group-data 변형이 버튼을 키우고 틴트를 올린다.
  const setTrayCommit = (id: string, on: boolean) => {
    const tray = moveLayerRefs.current.get(id)?.parentElement?.querySelector<HTMLElement>('[data-tray]');
    if (!tray) return;
    if (on) tray.dataset.commit = '1';
    else delete tray.dataset.commit;
  };

  const persistOrder = useCallback((orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    // 실패를 조용히 삼키면 화면 순서와 서버 순서가 어긋난 채 재진입 시 슬그머니 원복됨 →
    // 사용자에게 알리고 서버 순서로 되돌린다.
    api('/api/boards/reorder', { method: 'PATCH', json: { orderedIds } }).catch(() => {
      showToast('순서를 저장하지 못했어요. 다시 시도해주세요.');
      loadBoards();
    });
  }, [showToast, loadBoards]);

  // 손을 뗌(또는 취소): 시각 순서를 실제 배열 순서로 한 번만 커밋하고, 그 전이를 FLIP으로
  // 정착시킨다(아래 useLayoutEffect). 보이는 카드만 재배열 — 수확된 카드의 order는 보존된다.
  const endLift = useCallback((persist: boolean) => {
    stopAutoScroll(); // 손을 떼면(또는 취소) 자동 스크롤 루프부터 멈춘다
    unblockNativeScroll(); // 모든 종료 경로에서 touchmove 차단 해제 보장 — 특히 회전 종료
                           // (onUp/onCancel은 releaseCapture 경유로 풀지만, orientationchange는
                           //  endLift만 호출하므로 여기서 풀지 않으면 페이지 스크롤이 영구히 죽는다).
    orientAbortRef.current?.abort(); // 회전 안전종료 리스너 해제
    orientAbortRef.current = null;
    const L = liftRef.current;
    if (!L) return;
    liftRef.current = null;
    const finalIds = arrayMove(L.ids, L.source, L.target);
    // FLIP First: 커밋 직전, 각 행의 현재 화면상 top(드래그 transform 포함)을 기록.
    const first = new Map<string, number>();
    for (const id of L.ids) {
      const el = cardRefs.current.get(id);
      if (el) first.set(id, el.getBoundingClientRect().top);
    }
    flipRef.current = first;
    // 커밋: finalIds 순서대로 order 부여 → displayBoards 재정렬 + 리프트 해제.
    const orderMap = new Map(finalIds.map((id, i) => [id, i] as const));
    mutateBoards((prev) =>
      prev && { ...prev, boards: prev.boards.map((b) => (orderMap.has(b.id) ? { ...b, order: orderMap.get(b.id)! } : b)) });
    setLiftedId(null);
    if (persist && L.target !== L.source) persistOrder(finalIds);
  }, [mutateBoards, persistOrder, stopAutoScroll, unblockNativeScroll]);

  // 드래그 중 백그라운드 재검증/외부 삭제로 들어올린 보드가 목록에서 사라지면, 멈춰줄
  // 포인터 이벤트(pointerup)가 영영 안 와 리프트가 매달린다 — 자동 스크롤 루프와 touchmove
  // 차단이 누수된다. boards가 바뀔 때 들린 id가 없어졌으면 안전 종료. (정상 드롭은 endLift이
  // liftRef를 먼저 비우므로 여기선 no-op.)
  useEffect(() => {
    const L = liftRef.current;
    if (L && !boards.some((b) => b.id === L.id)) endLift(false);
  }, [boards, endLift]);

  // 길게 눌러 카드를 들어올림 → 세로 드래그 정렬 모드 진입.
  const doLift = (board: BoardSummary) => {
    gLpTimer.current = null;
    if (!canReorder) return; // '전체' 탭에서만 정렬
    feedbackTap();
    const ids = displayBoards.map((b) => b.id);
    const source = ids.indexOf(board.id);
    if (source < 0) return;
    // 진행 중인 FLIP 정착 리스너를 정리(빠른 재리프트로 transition이 끊기면 transitionend가
    // 울리지 않아 리스너가 남는다 — abort로 일괄 제거).
    flipAbortRef.current?.abort();
    // 정적 스냅샷 — 드래그 중 행은 DOM에서 안 움직이고 transform만 바뀐다.
    // 직전 FLIP 잔여 인라인 스타일을 먼저 비워 자연 슬롯 위치를 정확히 측정한다.
    const tops: number[] = [];
    const heights: number[] = [];
    for (const id of ids) {
      const el = cardRefs.current.get(id);
      if (el) { el.style.transition = 'none'; el.style.transform = ''; }
      const r = el?.getBoundingClientRect();
      tops.push(r?.top ?? 0);
      heights.push(r?.height ?? 0);
    }
    const snap: SlotSnapshot = { tops, heights };
    liftRef.current = {
      id: board.id,
      ids,
      snap,
      source,
      target: source,
      footprint: rowFootprint(snap, source, inferRowGap(snap)),
      startY: gLastY.current,
      scrollY0: window.scrollY,
    };
    setLiftedId(board.id);
    blockNativeScroll(); // 진행 중 터치는 touch-action으로 못 막는다 — touchmove preventDefault만 유효
    const el = gEl.current;
    if (el && gPointerId.current != null) {
      el.style.touchAction = 'none'; // 다음 터치 대비(이번 터치엔 무효 — 위 blocker가 담당)
      try { el.setPointerCapture(gPointerId.current); } catch { /* noop */ }
    }
    // 리프트 순간 손가락이 이미 엣지존이면(화면 하단 카드 롱프레스 후 정지) 자동 스크롤을
    // 콜드 스타트한다 — onMove가 한 번도 안 떠도 스크롤이 시작되게(self-restart는 기동 후에만).
    if (autoScrollRaf.current == null &&
        edgeScrollVelocity(gLastY.current, window.innerHeight - NAV_INSET, EDGE_ZONE, EDGE_MAX_SPEED) !== 0) {
      autoScrollRaf.current = requestAnimationFrame(autoScrollTick);
    }
    // 정렬 중 기기 회전은 뷰포트 스냅샷을 무효화한다 → 잘못된 슬롯에 드롭되기 전에 안전 종료.
    // (resize가 아니라 orientationchange만 — 모바일 주소창 show/hide로 드래그가 끊기지 않게.)
    const orientAc = new AbortController();
    orientAbortRef.current = orientAc;
    window.addEventListener('orientationchange', () => {
      endLift(false);
      // 회전으로 끊긴 드래그: 손가락이 아직 닿아 있다 — 포인터 캡처·터치액션·제스처 상태를
      // 정리해, 뒤이은 pointerup이 '탭'(상세 열기)으로 오인되지 않게 한다.
      const dragEl = gEl.current;
      if (dragEl && gPointerId.current != null) {
        try { dragEl.releasePointerCapture(gPointerId.current); } catch { /* noop */ }
        dragEl.style.touchAction = '';
      }
      gStart.current = null;
      gAxis.current = null;
      gMoved.current = true; // 이미 제스처가 소비됨 → 뒤이은 pointerup이 탭 경로로 빠지지 않게
    }, { signal: orientAc.signal });
  };

  const onDown = (e: React.PointerEvent, board: BoardSummary) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 정렬 리프트 진행 중엔 둘째 포인터(다른 손가락) 무시 — gPointerId를 덮어쓰면
    // 원래 캡처한 포인터가 releaseCapture에서 풀리지 않아 카드가 먹통이 된다.
    if (liftRef.current) return;
    if (swipeOpenId && swipeOpenId !== board.id) setSwipeOpenId(null); // 다른 카드 트레이 닫기
    gStart.current = { x: e.clientX, y: e.clientY };
    gLastY.current = e.clientY;
    gMoved.current = false;
    gAxis.current = null;
    gPointerId.current = e.pointerId;
    gEl.current = e.currentTarget as HTMLElement;
    clearLp();
    // 트레이(수확/삭제) 위에서 시작한 누름은 길이와 무관하게 버튼 동작이어야 한다 —
    // 리프트 타이머만 무장하지 않는다(스와이프 추적은 유지: 트레이에서 드래그로 닫기 가능).
    if (!(e.target as HTMLElement).closest('[data-tray]')) {
      gLpTimer.current = window.setTimeout(() => doLift(board), LIFT_MS);
    }
  };

  const onMove = (e: React.PointerEvent, board: BoardSummary) => {
    // 리프트 중엔 들어올린 그 포인터만 처리한다 — 둘째 손가락(다른 카드)이 gLastY를 가로채
    // 자동 스크롤 tick과 드래그 추적을 엉뚱한 좌표로 끌고 가거나, 캡처 안 된 채 스와이프
    // 로직으로 새는 것을 막는다(onDown은 이미 둘째 포인터를 무시하지만 onMove는 아니었다).
    if (liftRef.current && e.pointerId !== gPointerId.current) return;
    gLastY.current = e.clientY;
    // 리프트 판정은 동기 ref로 — liftedId(state)는 doLift 직후 한 프레임 비어 있어,
    // 리프트 직후 끝나는 제스처(특히 모바일 pointercancel)가 stale null을 읽고 종료 처리를
    // 건너뛰면 liftRef·touchmove blocker가 안 풀려 페이지 스크롤이 영구히 죽는다(entry/exit 대칭).
    if (liftRef.current?.id === board.id) {
      e.preventDefault();
      // 손가락 추적·이웃 비켜주기는 applyLiftMove가 전담(자동 스크롤 틱도 같은 함수를 쓴다).
      applyLiftMove(e.clientY);
      // 손가락이 화면 위/아래 엣지존에 들어오면 자동 스크롤 루프를 깨운다
      // (엣지를 벗어나면 틱이 스스로 멈춘다 → 손가락 정지 중에도 엣지 이탈을 감지).
      if (autoScrollRaf.current == null &&
          edgeScrollVelocity(e.clientY, window.innerHeight - NAV_INSET, EDGE_ZONE, EDGE_MAX_SPEED) !== 0) {
        autoScrollRaf.current = requestAnimationFrame(autoScrollTick);
      }
      return;
    }
    const st = gStart.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    // x축 잠금 공통 절차 — 최초 판정과 y→x 늦은 승격 두 경로에서 호출.
    // rebase: 잠금 시점의 누적 dx를 기준점으로 삼아 카드가 그 지점부터 0에서 끌리게
    // 한다(늦은 승격 시 수십 px 점프 방지; 최초 잠금은 dx≈±10이라 체감 동일).
    const lockX = () => {
      gAxis.current = 'x';
      gSwipeBase.current = dx;
      gCardW.current = (e.currentTarget as HTMLElement).offsetWidth || 0;
      gCommitArmed.current = false;
      setSwipeDragId(board.id);
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    };
    if (gAxis.current === null) {
      if (Math.hypot(dx, dy) > MOVE_TOL) {
        clearLp();
        gMoved.current = true;
        // 축 판정: x는 수평 우세면 즉시, y는 '확실한 세로'(|dy| > |dx|×1.75)에만 잠근다.
        // 엄지 스와이프는 초기 몇 px에 세로 성분(아크)이 섞여, 첫 판정에서 y로 영구
        // 확정하면 이후 수평 140px가 통째로 버려진다(2026-07-06 CDP 터치 실측 — 실기기
        // '옆으로 밀어도 안 됨'의 원인). 대각은 잠금 보류 → 다음 move의 누적 벡터로 재평가.
        if (Math.abs(dx) > Math.abs(dy)) {
          lockX();
        } else if (Math.abs(dy) > Math.abs(dx) * 1.75) {
          gAxis.current = 'y';
        }
      }
    } else if (gAxis.current === 'y') {
      // y 잠금 후에도 pointermove가 계속 온다는 것 = 브라우저가 팬(스크롤)을 가져가지
      // 않았다는 뜻(가져가면 touch-action: pan-y 규약상 pointercancel로 끊긴다).
      // 그 상태에서 수평이 명백히 우세해지면(누적 |dx|≥32 && |dx|>|dy|×1.2) 사용자의
      // 의도는 스와이프다 — x로 승격해 세로 시작 아크를 구제한다. 실스크롤 중에는
      // 이 분기 자체가 도달 불가라 오탐 없음.
      if (Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        lockX();
      }
    }
    if (gAxis.current === 'x') {
      e.preventDefault();
      const base = swipeOpenId === board.id ? -TRAY_W : 0;
      // 완성 보드(수확/되돌리기 가능)만 트레이 너머 풀스와이프 허용.
      const min = board.isCompleted ? -Math.round(gCardW.current * FULL_CLAMP_FRAC) : -TRAY_W;
      const next = Math.max(min, Math.min(0, base + (dx - gSwipeBase.current)));
      gSwipeDx.current = next;
      // pointermove마다 setState 금지 — transform 직접 조작(상태 전이는 onUp에서만).
      setCardX(board.id, next, false);
      if (board.isCompleted) {
        const committed = next <= -Math.round(gCardW.current * FULL_COMMIT_FRAC);
        if (committed !== gCommitArmed.current) {
          gCommitArmed.current = committed;
          setTrayCommit(board.id, committed);
          if (committed) feedbackTap(); // 임계 통과 순간 1회 — '여기서 놓으면 수확' 신호
        }
      }
    }
  };

  const releaseCapture = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (gEl.current) gEl.current.style.touchAction = ''; // 클래스(touch-pan-y) 값으로 복귀
    unblockNativeScroll();
  };

  const onUp = (e: React.PointerEvent, board: BoardSummary) => {
    clearLp();
    if (liftRef.current?.id === board.id) {
      releaseCapture(e);
      endLift(true);
      gStart.current = null;
      return;
    }
    if (gAxis.current === 'x') {
      // 풀스와이프 커밋 — 완성 보드를 임계 너머에서 놓으면 트레이 정차 없이 바로
      // 수확/되돌리기. 카드가 목록에서 빠지며(수확) 사라지거나(되돌리기도 탭 이동)
      // 낙관 갱신이 처리하므로 스냅백은 닫힘 위치로 보낸다.
      if (board.isCompleted && gCommitArmed.current) {
        gCommitArmed.current = false;
        setTrayCommit(board.id, false);
        setCardX(board.id, 0, true);
        setSwipeOpenId(null);
        setSwipeDragId(null);
        gSwipeDx.current = 0;
        releaseCapture(e);
        gStart.current = null;
        harvestBoard(board);
        return;
      }
      const open = gSwipeDx.current <= -TRAY_W / 2;
      // 손을 뗀 지점 → 확정 위치 스냅백도 직접 조작으로 애니메이션한다.
      // (열림/닫힘이 기존 상태와 같으면 React가 transform을 다시 쓰지 않으므로
      //  이 수동 쓰기가 없으면 카드가 드래그 위치에 멈춘 채 남는다.)
      setCardX(board.id, open ? -TRAY_W : 0, true);
      setTrayCommit(board.id, false);
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
    if (liftRef.current?.id === board.id) { endLift(false); }
    // swipeDragId(state)는 축 잠금 직후 취소되면 아직 stale일 수 있어 ref로도 판정.
    if (gAxis.current === 'x' || swipeDragId === board.id) {
      setSwipeDragId(null);
      setCardX(board.id, swipeOpenId === board.id ? -TRAY_W : 0, true); // 직전 정지 위치로 복귀
      setTrayCommit(board.id, false);
      gCommitArmed.current = false;
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

  // 드롭 후 FLIP 정착 — 커밋으로 재정렬된 행을 '직전 화면 위치(First)'에서 '최종 슬롯(Last)'으로
  // 활주시킨다. paint 전 동기 처리(useLayoutEffect)라 중간 깜빡임이 없다. transform은 레이아웃에
  // 영향이 없어 각 행을 독립적으로 측정/역보정할 수 있다. (감속 모션 사용자는 globals.css 백스톱이
  // transition을 무력화 → 즉시 스냅.) flipRef가 비어 있으면(일반 boards 변경) 즉시 반환.
  useLayoutEffect(() => {
    const first = flipRef.current;
    if (!first) return;
    flipRef.current = null;
    // 이 배치의 transitionend 리스너 수명을 한 컨트롤러로 묶는다. 다음 FLIP·재리프트·
    // 언마운트 때 abort 하면, transition이 중간에 끊겨 transitionend가 안 울리는 경우에도
    // 리스너가 누적되지 않는다. ({ once }로 정상 1회 발화 후엔 자동 제거.)
    flipAbortRef.current?.abort();
    const ctrl = new AbortController();
    flipAbortRef.current = ctrl;
    first.forEach((firstTop, id) => {
      const el = cardRefs.current.get(id);
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform = '';                        // 자연 슬롯으로 → Last 측정
      const delta = firstTop - el.getBoundingClientRect().top;
      if (!delta) { el.style.transition = ''; return; }
      el.style.transform = `translateY(${delta}px)`;  // Invert: 직전 화면 위치로 복귀
      void el.getBoundingClientRect();                // 강제 reflow로 시작 상태 고정
      el.style.transition = REORDER_TRANSITION;        // Play: 최종 슬롯으로 전이
      el.style.transform = 'translateY(0)';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
        el.style.transform = '';
      }, { once: true, signal: ctrl.signal });
    });
    return () => ctrl.abort();
  }, [boards]);

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
        <EmptyState
          art="/illustrations/empty/empty-home-v2.webp"
          icon={<Podo size={96} />}
          title={filter === 'all' ? '아직 포도판이 없어요' : filter === 'active' ? '진행중인 포도판이 없어요' : filter === 'completed' ? '완료한 포도판이 없어요' : '수확한 포도판이 없어요'}
          description={filter === 'all' ? '한 알씩 채워볼 첫 판을 만들어 보세요' : undefined}
        >
          {filter === 'all' && (
            /* href(<Link>): 보드 0개 신규 사용자 경로도 /board/create 프리페치를 받는다(FAB와 동일). */
            <ClayButton variant="joyful" href="/board/create" onClick={feedbackTap}>
              포도판 만들기
            </ClayButton>
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {displayBoards.map((board, i) => (
              // 스태거는 li(정적 래퍼)에만 — FLIP/스와이프가 잡는 transform 레이어는
              // SwipeableBoardCard 내부(innerRef/moveLayerRef)라 인라인 transform과 충돌 없음.
              <li
                key={board.id}
                className="stagger-item"
                style={{ '--stagger-i': Math.min(i, 8) } as React.CSSProperties}
              >
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
            {canReorder ? '꾹 눌러 위아래로 정렬 · 옆으로 밀어 수확' : '카드를 옆으로 밀어 수확할 수 있어요'}
          </p>
        </>
      )}

      {/* 친구 소식 — 최근 7일 내 친구가 완성한 포도판. 활동 0건/친구 0명이거나 설정에서
          숨긴 경우(hideFriendFeed, ABS-14) 통째로 숨김. fetch(useCachedApi)는 그대로 유지
          — 조건부 훅 호출 금지, 여기서는 렌더만 가린다. */}
      {!settings.hideFriendFeed && friendActivities.length > 0 && (
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

      {/* FAB — <Link>라 항상 뷰포트에 있어 /board/create가 상시 프리페치된다
          (하단탭 '만들기' 제거로 사라진 탭 프리페치를 여기서 대신함). */}
      {boards.length > 0 && (
        <Link
          href="/board/create"
          onClick={feedbackTap}
          className="fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center text-3xl text-white bg-grape-600 border-[1.3px] border-warm-border active:translate-x-[1.5px] active:translate-y-[2px] transition-all z-40 safe-bottom"
          style={{ boxShadow: '2px 3px 0 rgba(73, 50, 100, 0.12)' }}
          aria-label="새 포도판 만들기"
        >
          +
        </Link>
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
