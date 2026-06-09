'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import ClayButton from '@/components/ClayButton';
import Avatar from '@/components/Avatar';
import type { RelayInfo } from '@/types';
import { feedbackTap } from '@/lib/feedback';
import EmojiIcon from '@/components/EmojiIcon';

interface PodongListProps {
  /** Show the page H1. False when embedded under the 친구 page header. */
  heading?: boolean;
}

const LIFT_MS = 450;
const MOVE_TOL = 10;

export default function PodongList({ heading = true }: PodongListProps) {
  const router = useRouter();
  const { relays, setRelays } = useAppStore();
  const user = useAppStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // 진행중 포도동 개인 정렬(REQ12) — 서버 변경 없이 localStorage에 사용자별로 보관.
  const orderKey = user ? `podoal-relay-order:${user.id}` : 'podoal-relay-order';
  const [personalOrder, setPersonalOrder] = useState<string[]>([]);
  const [liftedId, setLiftedId] = useState<string | null>(null);

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragOrderRef = useRef<string[]>([]);
  const gStart = useRef<{ x: number; y: number } | null>(null);
  const gMoved = useRef(false);
  const gPointerId = useRef<number | null>(null);
  const gEl = useRef<HTMLElement | null>(null);
  const gLpTimer = useRef<number | null>(null);

  const loadRelays = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    api<{ relays: RelayInfo[] }>('/api/relays')
      .then((data) => setRelays(data.relays))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [setRelays]);

  useEffect(() => { loadRelays(); }, [loadRelays]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(orderKey);
      if (raw) setPersonalOrder(JSON.parse(raw));
    } catch { /* noop */ }
  }, [orderKey]);

  const completedRelays = relays.filter((r) => r.status === 'completed');
  const activeRelays = relays
    .filter((r) => r.status === 'active')
    .sort((a, b) => {
      const ai = personalOrder.indexOf(a.id);
      const bi = personalOrder.indexOf(b.id);
      const av = ai < 0 ? Number.MAX_SAFE_INTEGER : ai;
      const bv = bi < 0 ? Number.MAX_SAFE_INTEGER : bi;
      if (av !== bv) return av - bv;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  const getActiveParticipant = (relay: RelayInfo) => relay.participants.find((p) => p.status === 'active');
  const getCompletedCount = (relay: RelayInfo) => relay.participants.filter((p) => p.status === 'completed').length;

  const clearLp = () => { if (gLpTimer.current) { window.clearTimeout(gLpTimer.current); gLpTimer.current = null; } };

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
    setPersonalOrder(next);
  }, []);

  const persistOrder = useCallback(() => {
    const ids = dragOrderRef.current;
    if (ids.length === 0) return;
    try { localStorage.setItem(orderKey, JSON.stringify(ids)); } catch { /* noop */ }
  }, [orderKey]);

  const doLift = (relayId: string) => {
    gLpTimer.current = null;
    feedbackTap();
    setLiftedId(relayId);
    dragOrderRef.current = activeRelays.map((r) => r.id);
    const el = gEl.current;
    if (el && gPointerId.current != null) {
      el.style.touchAction = 'none';
      try { el.setPointerCapture(gPointerId.current); } catch { /* noop */ }
    }
  };

  const onDown = (e: React.PointerEvent, relayId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gStart.current = { x: e.clientX, y: e.clientY };
    gMoved.current = false;
    gPointerId.current = e.pointerId;
    gEl.current = e.currentTarget as HTMLElement;
    clearLp();
    gLpTimer.current = window.setTimeout(() => doLift(relayId), LIFT_MS);
  };

  const onMove = (e: React.PointerEvent, relayId: string) => {
    if (liftedId === relayId) {
      e.preventDefault();
      reorderMove(e.clientY, relayId);
      return;
    }
    const st = gStart.current;
    if (!st) return;
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > MOVE_TOL) { gMoved.current = true; clearLp(); }
  };

  const release = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (gEl.current) gEl.current.style.touchAction = '';
  };

  const onUp = (e: React.PointerEvent, relay: RelayInfo) => {
    clearLp();
    if (liftedId === relay.id) {
      persistOrder();
      setLiftedId(null);
      dragOrderRef.current = [];
      release(e);
      gStart.current = null;
      return;
    }
    if (!gMoved.current) { feedbackTap(); router.push(`/relay/${relay.id}`); }
    gStart.current = null;
  };

  const onCancel = (e: React.PointerEvent, relayId: string) => {
    clearLp();
    if (liftedId === relayId) { setLiftedId(null); dragOrderRef.current = []; }
    release(e);
    gStart.current = null;
  };

  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  const renderChain = (relay: RelayInfo, completedStyle = false) => {
    const isGroup = relay.mode === 'group';
    return (
      <div className="flex items-center gap-1">
        {relay.participants.map((p, idx) => {
          const isCompleted = completedStyle || p.status === 'completed';
          const dim = !isGroup && !completedStyle && (p.status === 'pending' || p.status === 'invited');
          const ring = !isGroup && !completedStyle && p.status === 'active';
          return (
            <div key={p.id} className="flex items-center">
              <div className={`relative ${ring ? 'ring-2 ring-grape-400 ring-offset-1 rounded-full' : ''}`}>
                <Avatar avatar={p.user.avatar} size="sm" className={dim ? 'opacity-40' : 'opacity-100'} />
                {isCompleted && (
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <EmojiIcon emoji={'✅'} size={14} />
                  </span>
                )}
              </div>
              {idx < relay.participants.length - 1 && (
                <div className={`w-4 h-0.5 mx-0.5 ${isCompleted ? 'bg-grape-400' : 'bg-warm-border'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {heading && (
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">
          <EmojiIcon emoji={'🔗'} size={24} className="mr-1.5" />포도동
        </h1>
      )}

      <ClayButton fullWidth size="lg" onClick={() => router.push('/relay/create')} className="mb-6">
        새 포도동 만들기
      </ClayButton>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 w-full" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={loadRelays} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : relays.length === 0 ? (
        <div className="text-center py-16">
          <EmojiIcon emoji={'🔗'} size={52} className="block mx-auto mb-4" />
          <p className="text-sm leading-relaxed text-warm-sub mb-1">아직 포도동이 없어요</p>
          <p className="text-sm leading-relaxed text-warm-sub mb-5">친구들과 함께 습관 포도동을 시작해 보세요!</p>
        </div>
      ) : (
        <>
          {/* Active — 꾹 눌러 위아래로 정렬(REQ12) */}
          {activeRelays.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-warm-sub mb-3">진행중인 포도동 ({activeRelays.length})</h2>
              <ul className="space-y-3">
                {activeRelays.map((relay) => {
                  const isGroup = relay.mode === 'group';
                  const active = getActiveParticipant(relay);
                  const completed = getCompletedCount(relay);
                  const total = relay.participants.length;
                  const isMyTurn = !isGroup && active?.userId === user?.id;
                  const invited = relay.participants.some((p) => p.userId === user?.id && p.status === 'invited');
                  const isLifted = liftedId === relay.id;
                  return (
                    <li key={relay.id} ref={setCardRef(relay.id)}>
                      <div
                        onPointerDown={(e) => onDown(e, relay.id)}
                        onPointerMove={(e) => onMove(e, relay.id)}
                        onPointerUp={(e) => onUp(e, relay)}
                        onPointerCancel={(e) => onCancel(e, relay.id)}
                        style={{ touchAction: 'pan-y' }}
                        className={`clay p-4 w-full text-left block transition-transform ${isLifted ? 'scale-[1.02] shadow-grape-glow relative z-10' : 'active:scale-[0.98]'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-warm-text">{relay.title}</h3>
                            <p className="text-xs text-warm-sub mt-0.5 tabular-nums">
                              {relay.totalStickers}알 | {total}명 참여
                            </p>
                          </div>
                          {invited ? (
                            <span className="px-2 py-1 rounded-lg bg-juice-100 text-juice-700 text-xs font-semibold">초대됨</span>
                          ) : isGroup ? (
                            <span className="px-2 py-1 rounded-lg bg-leaf-100 text-leaf-700 text-xs font-semibold">그룹</span>
                          ) : isMyTurn ? (
                            <span className="px-2 py-1 rounded-lg bg-grape-100 text-grape-600 text-xs font-semibold animate-pulse">내 차례!</span>
                          ) : null}
                        </div>

                        {renderChain(relay)}

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-warm-sub mb-1">
                            <span>진행률</span>
                            <span className="tabular-nums">{completed}/{total} 완료</span>
                          </div>
                          <div className="w-full h-2 bg-grape-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-grape-400 to-grape-500 rounded-full transition-all duration-500"
                              style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-center text-[11px] text-warm-sub mt-3">꾹 눌러 위아래로 순서를 바꿀 수 있어요</p>
            </div>
          )}

          {/* Completed */}
          {completedRelays.length > 0 && (
            <div>
              <button
                onClick={() => { feedbackTap(); setShowCompleted(!showCompleted); }}
                className="flex items-center gap-2 text-sm font-semibold text-warm-sub mb-3"
              >
                <span className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}>{'▶'}</span>
                완료된 포도동 ({completedRelays.length})
              </button>

              {showCompleted && (
                <div className="space-y-3">
                  {completedRelays.map((relay) => (
                    <button
                      type="button"
                      key={relay.id}
                      onClick={() => router.push(`/relay/${relay.id}`)}
                      className="clay p-4 w-full text-left block bg-leaf-100/60 active:scale-[0.98] transition-transform opacity-80"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-warm-text">{relay.title}</h3>
                          <p className="text-xs text-warm-sub mt-0.5 tabular-nums">
                            {relay.totalStickers}알 | {relay.participants.length}명 참여
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-leaf-100 text-leaf-700 text-xs font-semibold">완료</span>
                      </div>
                      {renderChain(relay, true)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
