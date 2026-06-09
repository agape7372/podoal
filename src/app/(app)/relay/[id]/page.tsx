'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import ClayButton from '@/components/ClayButton';
import Avatar from '@/components/Avatar';
import type { RelayInfo, RelayMode, BoardSummary } from '@/types';
import { feedbackRelay, feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { progressPercent } from '@/lib/format';
import { stripTitleEmoji } from '@/lib/title';
import EmojiIcon from '@/components/EmojiIcon';

interface RelayDetailParticipant {
  id: string;
  userId: string;
  user: { id: string; name: string; avatar: string };
  boardId: string | null;
  order: number;
  status: 'pending' | 'active' | 'completed';
  board: {
    id: string;
    title: string;
    totalStickers: number;
    filledCount: number;
    isCompleted: boolean;
    completedAt: string | null;
  } | null;
}

interface RelayDetail extends Omit<RelayInfo, 'participants'> {
  mode?: RelayMode;
  participants: RelayDetailParticipant[];
}

export default function RelayDetailPage() {
  const router = useRouter();
  const params = useParams();
  const relayId = params.id as string;
  const user = useAppStore((s) => s.user);

  const [relay, setRelay] = useState<RelayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [passing, setPassing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState('');

  // 그룹: 기존 포도판 불러오기
  const [attachOpen, setAttachOpen] = useState(false);
  const [myBoards, setMyBoards] = useState<BoardSummary[]>([]);
  const [loadingMyBoards, setLoadingMyBoards] = useState(false);

  const fetchRelay = useCallback(async () => {
    try {
      const data = await api<{ relay: RelayDetail }>(`/api/relays/${relayId}`);
      setRelay(data.relay);
    } catch {
      router.replace('/relay');
    } finally {
      setLoading(false);
    }
  }, [relayId, router]);

  useEffect(() => { fetchRelay(); }, [fetchRelay]);

  const handleJoin = async (boardId?: string) => {
    setJoining(true);
    setMessage('');
    try {
      await api(`/api/relays/${relayId}/join`, boardId ? { method: 'POST', json: { boardId } } : { method: 'POST' });
      feedbackSuccess();
      setAttachOpen(false);
      setMessage('포도동에 참여했어요.');
      await fetchRelay();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '참여에 실패했어요');
    }
    setJoining(false);
  };

  const openAttach = async () => {
    setAttachOpen(true);
    setLoadingMyBoards(true);
    try {
      const data = await api<{ boards: BoardSummary[] }>('/api/boards');
      setMyBoards((data.boards || []).filter((b) => b.owner.id === user?.id && !b.isCompleted && !b.harvestedAt));
    } catch { /* 빈 목록 */ }
    setLoadingMyBoards(false);
  };

  const handlePass = async () => {
    setPassing(true);
    setMessage('');
    try {
      const data = await api<{ message: string; relayCompleted: boolean }>(
        `/api/relays/${relayId}/pass`,
        { method: 'POST' },
      );
      feedbackRelay();
      setMessage(data.message);
      await fetchRelay();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '바통 넘기기에 실패했어요');
    }
    setPassing(false);
  };

  if (loading) {
    return (
      <div className="pb-4">
        <div className="skeleton h-8 w-32 mb-6" />
        <div className="skeleton h-12 w-full mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      </div>
    );
  }

  if (!relay) return null;

  const isGroup = relay.mode === 'group';
  const myParticipant = relay.participants.find((p) => p.userId === user?.id);
  const isMyTurn = myParticipant?.status === 'active';
  const hasBoard = !!myParticipant?.boardId;
  const myBoardCompleted = myParticipant?.board?.isCompleted ?? false;
  const needsToJoin = !!myParticipant && !myParticipant.boardId;
  const isRelayCompleted = relay.status === 'completed';

  // 그룹: 가장 먼저 완성한 참가자(1등) 강조
  const firstFinisherId = isGroup
    ? relay.participants
        .filter((p) => p.board?.completedAt)
        .sort((a, b) => (a.board!.completedAt! < b.board!.completedAt! ? -1 : 1))[0]?.id ?? null
    : null;

  const statusBadge = isRelayCompleted
    ? { text: '완료', color: 'bg-leaf-100 text-leaf-700' }
    : { text: '진행중', color: 'bg-grape-100 text-grape-600' };

  const participantStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return { text: '완료', color: 'bg-leaf-100 text-leaf-700' };
      case 'active': return { text: '진행중', color: 'bg-grape-100 text-grape-600' };
      default: return { text: '대기중', color: 'bg-warm-border text-warm-sub' };
    }
  };

  const boardProgress = (p: RelayDetailParticipant) => p.board && (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-warm-sub mb-1">
        <span>{stripTitleEmoji(p.board.title)}</span>
        <span className="tabular-nums">{p.board.filledCount}/{p.board.totalStickers}</span>
      </div>
      <div className="w-full h-1.5 bg-grape-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-grape-300 to-grape-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent(p.board.filledCount, p.board.totalStickers)}%` }}
        />
      </div>
    </div>
  );

  const myBoardLink = (p: RelayDetailParticipant) => p.userId === user?.id && p.boardId && (isGroup || p.status === 'active') && (
    <div className="mt-3">
      <ClayButton
        size="sm"
        variant={myBoardCompleted ? 'secondary' : 'primary'}
        fullWidth
        onClick={(e) => { e.stopPropagation(); router.push(`/board/${p.boardId}`); }}
      >
        {myBoardCompleted ? '내 포도판 보기' : '내 포도판으로 이동'}
      </ClayButton>
    </div>
  );

  return (
    <div className="pb-4">
      {/* Back */}
      <button
        onClick={() => { feedbackTap(); router.push('/relay'); }}
        className="clay-button px-3 py-2 rounded-xl text-sm text-warm-sub mb-4"
      >
        ← 포도동
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-grape-700">{relay.title}</h1>
        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusBadge.color}`}>{statusBadge.text}</span>
      </div>

      {/* Info */}
      <div className="clay-sm p-4 mb-6">
        <div className="flex items-center gap-3 text-sm text-warm-sub flex-wrap">
          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${isGroup ? 'bg-leaf-100 text-leaf-700' : 'bg-grape-100 text-grape-600'}`}>
            {isGroup ? '그룹' : '릴레이'}
          </span>
          <span className="tabular-nums">{relay.totalStickers}알</span>
          <span>|</span>
          <span className="tabular-nums">{relay.participants.length}명 참여</span>
          <span>|</span>
          <span>만든이: {relay.creator.name}</span>
        </div>
      </div>

      {/* Completed celebration */}
      {isRelayCompleted && (
        <div className="clay p-6 mb-6 bg-amber-50/60 text-center">
          <EmojiIcon emoji={'🎉'} size={40} className="block mx-auto mb-2" />
          <p className="font-bold text-grape-700 text-lg mb-1">포도동 완료!</p>
          <p className="text-sm text-warm-sub">
            {isGroup ? '모두가 포도판을 완성했어요. 수고했어요!' : '모든 참가자가 포도판을 완성했어요. 모두 수고했어요!'}
          </p>
        </div>
      )}

      {/* Participants */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-warm-sub mb-4">참가자 현황</h2>

        {isGroup ? (
          /* 그룹: 병렬 멤버 리스트 (순서/바통/연결선 없음) */
          <div className="space-y-3">
            {relay.participants.map((p) => {
              const done = p.status === 'completed' || p.board?.isCompleted;
              return (
                <div key={p.id} className={`p-4 rounded-2xl ${done ? 'clay bg-leaf-100/40' : 'clay-sm'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar avatar={p.user.avatar} size="md" />
                      <div>
                        <p className="font-semibold text-warm-text">
                          {p.user.name}
                          {p.userId === user?.id && <span className="text-xs text-grape-400 ml-1">(나)</span>}
                        </p>
                        {p.id === firstFinisherId && (
                          <p className="text-xs font-semibold text-sunshine-700">1등 완성!</p>
                        )}
                      </div>
                    </div>
                    {done && (
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-leaf-100 text-leaf-700">완료</span>
                    )}
                  </div>
                  {boardProgress(p)}
                  {myBoardLink(p)}
                </div>
              );
            })}
          </div>
        ) : (
          /* 릴레이: 세로 턴 타임라인 */
          <div className="relative">
            {relay.participants.map((p, idx) => {
              const statusInfo = participantStatusLabel(p.status);
              const isActive = p.status === 'active';
              const isCompleted = p.status === 'completed';
              const isLast = idx === relay.participants.length - 1;
              return (
                <div key={p.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isCompleted ? 'bg-grape-500' : isActive ? 'bg-grape-400 ring-4 ring-grape-200 animate-pulse' : 'bg-warm-border'}`} />
                    {!isLast && <div className={`w-0.5 h-16 ${isCompleted ? 'bg-grape-400' : 'bg-warm-border'}`} />}
                  </div>
                  <div className={`flex-1 mb-3 p-4 rounded-2xl transition-all ${isActive ? 'clay bg-grape-50 ring-2 ring-grape-300' : 'clay-sm'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar avatar={p.user.avatar} size="md" />
                        <div>
                          <p className="font-semibold text-warm-text">
                            {p.user.name}
                            {p.userId === user?.id && <span className="text-xs text-grape-400 ml-1">(나)</span>}
                          </p>
                          <p className="text-xs text-warm-sub">{p.order === 0 ? '첫 번째' : `${p.order + 1}번째`} 주자</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusInfo.color}`}>{statusInfo.text}</span>
                    </div>
                    {boardProgress(p)}
                    {myBoardLink(p)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action area */}
      {message && (
        <div className="clay-sm p-3 mb-4 text-center">
          <p className="text-sm text-warm-text">{message}</p>
        </div>
      )}

      {/* Join: 참가자인데 아직 보드 없음 */}
      {needsToJoin && !isGroup && (
        <ClayButton fullWidth size="lg" onClick={() => handleJoin()} loading={joining}>
          포도동 참여하기
        </ClayButton>
      )}
      {needsToJoin && isGroup && (
        <div className="space-y-2">
          <ClayButton fullWidth size="lg" onClick={() => handleJoin()} loading={joining}>
            새 포도판 만들기
          </ClayButton>
          <ClayButton fullWidth variant="secondary" onClick={openAttach} disabled={joining}>
            기존 포도판 불러오기
          </ClayButton>
        </div>
      )}

      {/* 릴레이: 바통 — '차례인데 이미 완성된' 엣지에서만(완성 시 자동 진행됨) */}
      {!isGroup && isMyTurn && hasBoard && myBoardCompleted && (
        <ClayButton fullWidth size="lg" onClick={handlePass} loading={passing}>
          <EmojiIcon emoji={'🏃'} size={18} className="mr-1" />바통 넘기기
        </ClayButton>
      )}

      {/* 릴레이: 내 차례이고 아직 미완성 — 완성 시 자동 진행 안내 */}
      {!isGroup && isMyTurn && hasBoard && !myBoardCompleted && (
        <div className="clay-sm p-4 text-center bg-grape-50">
          <p className="text-sm text-warm-sub">포도판을 완성하면 자동으로 다음 주자에게 넘어가요!</p>
        </div>
      )}

      {/* 기존 포도판 불러오기 모달(그룹) */}
      {attachOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setAttachOpen(false); }}
        >
          <div className="w-full max-w-lg bg-clay-bg rounded-t-[28px] clay-float p-5 pb-8 safe-bottom max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-grape-700">기존 포도판 불러오기</h3>
              <button onClick={() => setAttachOpen(false)} className="text-warm-sub text-sm">닫기</button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              {loadingMyBoards ? (
                <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
              ) : myBoards.length === 0 ? (
                <p className="text-sm text-warm-sub text-center py-8">불러올 진행중인 포도판이 없어요</p>
              ) : (
                <div className="space-y-2">
                  {myBoards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleJoin(b.id)}
                      disabled={joining}
                      className="w-full clay-sm p-3 text-left flex items-center justify-between disabled:opacity-60"
                    >
                      <span className="text-sm font-medium text-warm-text truncate">{stripTitleEmoji(b.title)}</span>
                      <span className="text-xs text-warm-sub tabular-nums ml-2">{b.filledCount}/{b.totalStickers}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
