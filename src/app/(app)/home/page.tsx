'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import BoardCard from '@/components/BoardCard';
import ClayButton from '@/components/ClayButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import Avatar from '@/components/Avatar';
import Podo from '@/components/mascot/Podo';
import Sparkle from '@/components/illustrations/Sparkle';
import VineLeaf from '@/components/illustrations/VineLeaf';
import type { BoardSummary } from '@/types';
import { feedbackTap } from '@/lib/feedback';

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

// 제스처 상수
const LONG_PRESS_MS = 450;  // 꾹 누름 → 카드 "집기"
const MOVE_TOL = 10;        // 집기 전 이만큼 움직이면 스크롤로 간주(집기 취소)
const AXIS_TOL = 8;         // 집은 뒤 축(세로=정렬/가로=액션) 결정 임계
const ACTION_WIDTH = 152;   // 스와이프로 드러나는 액션 영역 폭(px)
const ACTION_OPEN = 60;     // 이만큼 왼쪽으로 밀면 액션 고정

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const greeting = useMemo(timeOfDayGreeting, []);

  // 관리 제스처 상태
  const [armedId, setArmedId] = useState<string | null>(null);   // 꾹 눌러 집은 카드
  const [axis, setAxis] = useState<'' | 'v' | 'h'>('');           // 집은 뒤 잠긴 축
  const [swipeX, setSwipeX] = useState(0);                        // 집은 카드의 가로 오프셋
  const [actionId, setActionId] = useState<string | null>(null); // 액션(수확/삭제) 열린 카드
  const [deleteTarget, setDeleteTarget] = useState<BoardSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lpTimer = useRef<number | null>(null);
  const gesture = useRef<{ id: string; startX: number; startY: number; moved: boolean; el: HTMLElement; pointerId: number } | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragOrderRef = useRef<string[]>([]); // 드래그 중 보이는 카드 순서(클로저 staleness 회피)

  const loadBoards = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    api<{ boards: BoardSummary[] }>('/api/boards')
      .then((data) => setBoards(data.boards))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

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

  const clearLp = () => { if (lpTimer.current) { window.clearTimeout(lpTimer.current); lpTimer.current = null; } };

  const resetGesture = useCallback(() => {
    clearLp();
    gesture.current = null;
    dragOrderRef.current = [];
    setArmedId(null);
    setAxis('');
    setSwipeX(0);
  }, []);

  // 세로 드래그 — 드래그 순서를 ref(dragOrderRef)에 보관해 클로저 staleness/이벤트 배치 레이스를 피한다.
  // hit-test는 포인터 Y가 들어있는 카드 1개를 찾으므로 순서와 무관. 보이는(비수확) 카드만 재배열하고
  // 수확된 카드의 order는 건드리지 않는다.
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
    setBoards((prev) => prev.map((b) => (orderMap.has(b.id) ? { ...b, order: orderMap.get(b.id)! } : b)));
  }, []);

  const persistOrder = useCallback(() => {
    const orderedIds = dragOrderRef.current;
    if (orderedIds.length === 0) return;
    api('/api/boards/reorder', { method: 'PATCH', json: { orderedIds } }).catch(() => {});
  }, []);

  const onPointerDown = (e: React.PointerEvent, board: BoardSummary) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 다른 카드의 열린 액션은 닫는다.
    if (actionId && actionId !== board.id) setActionId(null);
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    gesture.current = { id: board.id, startX: e.clientX, startY: e.clientY, moved: false, el, pointerId };
    clearLp();
    // 캡처는 "집은 순간"에만 — 그 전엔 페이지 세로 스크롤을 그대로 허용.
    lpTimer.current = window.setTimeout(() => {
      feedbackTap();
      try { el.setPointerCapture(pointerId); } catch { /* noop */ }
      setArmedId(board.id);
      setAxis('');
      setSwipeX(0);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent, board: BoardSummary) => {
    const g = gesture.current;
    if (!g || g.id !== board.id) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (armedId !== board.id) {
      // 집기 전 움직임 → 스크롤 의도. 집기 타이머 취소하고 손 뗀다(브라우저 스크롤 허용).
      if (Math.hypot(dx, dy) > MOVE_TOL) { g.moved = true; clearLp(); }
      return;
    }

    // 집은 상태 — 축 잠금 후 처리
    let ax = axis;
    if (!ax) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > AXIS_TOL) ax = 'h';
      else if (Math.abs(dy) > AXIS_TOL) ax = 'v';
      if (ax) setAxis(ax);
    }
    if (ax === 'v') {
      if (canReorder) {
        if (dragOrderRef.current.length === 0) dragOrderRef.current = displayBoards.map((b) => b.id);
        reorderMove(e.clientY, board.id);
      }
    } else if (ax === 'h') {
      setSwipeX(Math.max(-ACTION_WIDTH, Math.min(0, dx))); // 왼쪽으로만 열림
    }
  };

  const onPointerUp = (e: React.PointerEvent, board: BoardSummary) => {
    const g = gesture.current;
    const wasArmed = armedId === board.id;
    clearLp();
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }

    if (!wasArmed) {
      // 빠른 탭 → 내비게이션(움직이지 않았고 액션도 안 열렸을 때)
      if (g && !g.moved) {
        if (actionId === board.id) setActionId(null);
        else { feedbackTap(); router.push(`/board/${board.id}`); }
      }
      gesture.current = null;
      return;
    }

    if (axis === 'h') {
      setActionId(swipeX <= -ACTION_OPEN ? board.id : null);
    } else if (axis === 'v') {
      persistOrder();
    }
    resetGesture();
  };

  const onPointerCancel = () => { resetGesture(); };

  const harvestBoard = async (board: BoardSummary, harvested: boolean) => {
    feedbackTap();
    setActionId(null);
    setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, harvestedAt: harvested ? new Date().toISOString() : null } : b)));
    try {
      await api(`/api/boards/${board.id}`, { method: 'PATCH', json: { harvested } });
    } catch {
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, harvestedAt: harvested ? null : board.harvestedAt ?? null } : b)));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setActionId(null);
    }
  };

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
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight text-warm-text truncate">
            {user?.name}<span className="text-warm-sub font-normal text-[20px]">님</span>
          </h1>
          <p className="text-xs leading-normal tracking-wide text-warm-sub mt-0.5">
            {greeting}
          </p>
        </div>
      </div>

      {/* Filter tabs — 카운트 통합(전체/진행중/완료/수확 + 숫자) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'active', 'completed', 'harvested'] as const).map((f) => {
          const isActive = filter === f;
          const icon = f === 'active' ? <VineLeaf size={14} /> : f === 'completed' ? <Sparkle size={14} color="#FFC845" /> : null;
          const label = f === 'all' ? '전체' : f === 'active' ? '진행중' : f === 'completed' ? '완료' : '수확';
          const count = f === 'all' ? allCount : f === 'active' ? activeCount : f === 'completed' ? completedCount : harvestedCount;
          return (
            <button
              key={f}
              onClick={() => { feedbackTap(); setFilter(f); setActionId(null); }}
              aria-pressed={isActive}
              className={`
                px-3.5 py-2 rounded-2xl text-sm font-medium transition-all inline-flex items-center gap-1.5
                ${isActive
                  ? 'clay-pressed text-grape-700'
                  : 'clay-button text-warm-sub'
                }
              `}
            >
              {icon}
              {label}
              <span className={`font-display font-bold leading-none ${isActive ? 'text-grape-700' : 'text-warm-text'}`}>
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
              <p className="text-sm text-warm-sub mb-5">한 알씩 채워볼 첫 판을 만들어 보세요</p>
              <ClayButton variant="joyful" onClick={() => router.push('/board/create')}>
                포도판 만들기
              </ClayButton>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {displayBoards.map((board) => {
              const isArmed = armedId === board.id;
              const isDragging = isArmed && axis === 'v';
              const tx = isArmed && axis === 'h' ? swipeX : actionId === board.id ? -ACTION_WIDTH : 0;
              return (
                <li key={board.id} className="relative">
                  {/* 액션 레이어 (스와이프로 드러남) */}
                  <div className="absolute inset-y-0 right-0 flex items-stretch gap-2" style={{ width: ACTION_WIDTH }} aria-hidden={actionId !== board.id}>
                    <button
                      onClick={() => harvestBoard(board, !board.harvestedAt)}
                      className={`flex-1 rounded-2xl text-xs font-semibold flex items-center justify-center ${board.harvestedAt ? 'bg-leaf-100 text-leaf-700' : 'bg-grape-100 text-grape-700'}`}
                    >
                      {board.harvestedAt ? '되돌리기' : '수확'}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(board)}
                      className="flex-1 rounded-2xl text-xs font-semibold flex items-center justify-center bg-red-500 text-white"
                    >
                      삭제
                    </button>
                  </div>

                  {/* 카드(제스처 래퍼) */}
                  <div
                    ref={(el) => { if (el) cardRefs.current.set(board.id, el); else cardRefs.current.delete(board.id); }}
                    onPointerDown={(e) => onPointerDown(e, board)}
                    onPointerMove={(e) => onPointerMove(e, board)}
                    onPointerUp={(e) => onPointerUp(e, board)}
                    onPointerCancel={onPointerCancel}
                    style={{
                      transform: `translateX(${tx}px)${isDragging ? ' scale(1.03)' : ''}`,
                      transition: isArmed && axis === 'h' ? 'none' : 'transform 0.18s ease',
                      touchAction: isArmed ? 'none' : 'pan-y',
                      zIndex: isDragging ? 10 : undefined,
                      position: 'relative',
                    }}
                    className={isDragging ? 'shadow-grape-glow' : ''}
                  >
                    <BoardCard board={board} asStatic />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-center text-[11px] text-warm-sub mt-4">
            {canReorder ? '카드를 꾹 눌러 위·아래로 옮기거나, 옆으로 밀어 수확·삭제할 수 있어요' : '카드를 옆으로 밀어 수확·삭제할 수 있어요'}
          </p>
        </>
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

      {/* 삭제 확인 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="포도판을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요. 채운 포도알·보상도 모두 사라져요."
        confirmLabel="삭제"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) { setDeleteTarget(null); setActionId(null); } }}
      />
    </div>
  );
}
