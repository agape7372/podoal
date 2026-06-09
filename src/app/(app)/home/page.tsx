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

const LONG_PRESS_MS = 450; // 꾹 누름 → 관리 모드 진입
const MOVE_TOL = 10;       // 진입 전 이만큼 움직이면 스크롤 의도로 보고 취소

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const greeting = useMemo(timeOfDayGreeting, []);

  // 관리 모드 + 드래그 정렬 상태
  const [manageMode, setManageMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const lpMoved = useRef(false);
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

  // 보이는(비수확) 카드만 재배열, 수확된 카드의 order는 보존. hit-test는 포인터 Y가
  // 들어있는 행 1개를 찾으므로 순서와 무관. 순서는 ref에 보관해 클로저 staleness를 피한다.
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

  // --- 비-관리 모드: 카드 탭=내비, 꾹 누름=관리 모드 진입 ---
  const onCardDown = (e: React.PointerEvent) => {
    if (manageMode || (e.pointerType === 'mouse' && e.button !== 0)) return;
    lpStart.current = { x: e.clientX, y: e.clientY };
    lpMoved.current = false;
    clearLp();
    lpTimer.current = window.setTimeout(() => { feedbackTap(); setManageMode(true); }, LONG_PRESS_MS);
  };
  const onCardMove = (e: React.PointerEvent) => {
    if (manageMode || !lpStart.current) return;
    const dx = e.clientX - lpStart.current.x;
    const dy = e.clientY - lpStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOL) { lpMoved.current = true; clearLp(); } // 스크롤 의도 → 진입 취소
  };
  const onCardUp = (board: BoardSummary) => {
    clearLp();
    const moved = lpMoved.current;
    lpStart.current = null;
    if (manageMode) return; // 진입 직후엔 내비 안 함
    if (!moved) { feedbackTap(); router.push(`/board/${board.id}`); } // 빠른 탭 → 보드 열기
  };

  // --- 관리 모드: 드래그 핸들(touch-action:none)로 순서변경 ---
  const onGripDown = (e: React.PointerEvent, board: BoardSummary) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    dragOrderRef.current = displayBoards.map((b) => b.id);
    setDragId(board.id);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onGripMove = (e: React.PointerEvent, board: BoardSummary) => {
    if (dragId !== board.id) return;
    reorderMove(e.clientY, board.id);
  };
  const onGripUp = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    if (dragId) persistOrder();
    setDragId(null);
    dragOrderRef.current = [];
  };

  const exitManage = () => { feedbackTap(); setManageMode(false); setDragId(null); };

  const harvestBoard = async (board: BoardSummary, harvested: boolean) => {
    feedbackTap();
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
    }
  };

  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
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
              onClick={() => { feedbackTap(); setFilter(f); }}
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

      {/* 관리 모드 바 */}
      {manageMode && (
        <div className="flex items-center justify-between mb-3 px-1 animate-fade-in">
          <span className="text-sm font-medium text-grape-700">
            {canReorder ? '핸들을 끌어 순서 변경 · 수확·삭제' : '수확·삭제'}
          </span>
          <button
            onClick={exitManage}
            className="clay-button px-3.5 py-1.5 rounded-xl text-sm font-semibold text-grape-700"
          >
            완료
          </button>
        </div>
      )}

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
              <p className="text-sm text-warm-sub mb-5 [text-wrap:balance]">한 알씩 채워볼 첫 판을 만들어 보세요</p>
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
              const isDragging = dragId === board.id;

              if (manageMode) {
                return (
                  <li
                    key={board.id}
                    ref={setCardRef(board.id)}
                    className={`flex items-stretch gap-2 transition-transform ${isDragging ? 'scale-[1.02] relative z-10' : ''}`}
                  >
                    {canReorder && (
                      <button
                        aria-label="드래그하여 순서 변경"
                        onPointerDown={(e) => onGripDown(e, board)}
                        onPointerMove={(e) => onGripMove(e, board)}
                        onPointerUp={onGripUp}
                        onPointerCancel={onGripUp}
                        style={{ touchAction: 'none' }}
                        className={`clay-sm shrink-0 w-9 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-grape-glow' : ''}`}
                      >
                        {[0, 1, 2].map((i) => <span key={i} className="block w-4 h-0.5 rounded-full bg-warm-light" />)}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <BoardCard board={board} asStatic />
                    </div>
                    <div className="shrink-0 flex flex-col gap-1.5 justify-center w-[58px]">
                      {board.isCompleted && (
                        <button
                          onClick={() => harvestBoard(board, !board.harvestedAt)}
                          className={`rounded-xl py-2 text-xs font-semibold ${board.harvestedAt ? 'bg-leaf-100 text-leaf-700' : 'bg-grape-100 text-grape-700'}`}
                        >
                          {board.harvestedAt ? '되돌리기' : '수확'}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(board)}
                        className="rounded-xl py-2 text-xs font-semibold bg-red-500 text-white"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={board.id} ref={setCardRef(board.id)}>
                  <div
                    onPointerDown={onCardDown}
                    onPointerMove={onCardMove}
                    onPointerUp={() => onCardUp(board)}
                    onPointerCancel={() => { clearLp(); lpStart.current = null; }}
                    style={{ touchAction: 'pan-y' }}
                  >
                    <BoardCard board={board} asStatic />
                  </div>
                </li>
              );
            })}
          </ul>
          {!manageMode && (
            <p className="text-center text-[11px] text-warm-sub mt-4 [text-wrap:balance]">
              카드를 꾹 누르면 정렬·수확·삭제할 수 있어요
            </p>
          )}
        </>
      )}

      {/* FAB — 관리 모드에선 숨김 */}
      {boards.length > 0 && !manageMode && (
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
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
