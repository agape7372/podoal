'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import ClayButton from '@/components/ClayButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import type { RelayInfo, RelayMode, BoardSummary } from '@/types';
import { feedbackRelay, feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';
import EmojiIcon from '@/components/EmojiIcon';

interface RelayDetailBoard {
  id: string;
  title: string;
  totalStickers: number;
  filledCount: number;
  isCompleted: boolean;
  completedAt: string | null;
  harvestedAt: string | null;
}

interface RelayDetailParticipant {
  id: string;
  userId: string;
  user: { id: string; name: string; avatar: string };
  boardId: string | null;
  order: number;
  status: 'invited' | 'pending' | 'active' | 'completed';
  board: RelayDetailBoard | null;
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
  const [responding, setResponding] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
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

  const handleAccept = async () => {
    setResponding(true);
    setMessage('');
    try {
      await api(`/api/relays/${relayId}/accept`, { method: 'POST' });
      feedbackSuccess();
      setMessage('포도동에 참여했어요.');
      await fetchRelay();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '수락에 실패했어요');
    }
    setResponding(false);
  };

  // 거절은 비가역(참가자 행 삭제) — 오탭 방지로 ConfirmDialog를 거친다.
  const handleDecline = async () => {
    setResponding(true);
    setMessage('');
    try {
      await api(`/api/relays/${relayId}/decline`, { method: 'POST' });
      feedbackTap();
      setConfirmDecline(false);
      router.replace('/relay');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '거절에 실패했어요');
      setResponding(false);
      setConfirmDecline(false);
    }
  };

  const handleJoin = async (boardId?: string) => {
    setJoining(true);
    setMessage('');
    try {
      await api(`/api/relays/${relayId}/join`, boardId ? { method: 'POST', json: { boardId } } : { method: 'POST' });
      feedbackSuccess();
      setAttachOpen(false);
      setMessage('포도판을 연결했어요.');
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
  const myInvited = myParticipant?.status === 'invited';
  const isMyTurn = myParticipant?.status === 'active';
  const hasBoard = !!myParticipant?.boardId;
  const myBoardCompleted = myParticipant?.board?.isCompleted ?? false;
  const needsToJoin = !!myParticipant && !myInvited && !myParticipant.boardId;
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
      case 'invited': return { text: '초대 대기', color: 'bg-warm-border text-warm-sub' };
      default: return { text: '대기중', color: 'bg-warm-border text-warm-sub' };
    }
  };

  // 멤버 카드의 실시간 포도알 미리보기(REQ9) — 홈 카드와 동일한 미니 포도알.
  const miniGrapes = (board: RelayDetailBoard) => (
    <div className="mt-3">
      <div className="clay-pressed inline-flex flex-wrap gap-[3px] px-2 py-1.5" style={{ borderRadius: '12px' }}>
        {Array.from({ length: Math.min(board.totalStickers, 10) }, (_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full ${i < board.filledCount ? 'grape-filled-mini' : 'grape-empty-mini'}`} />
        ))}
        {board.totalStickers > 10 && (
          <span className="text-[10px] text-warm-sub self-center ml-0.5">+{board.totalStickers - 10}</span>
        )}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-warm-sub tabular-nums">
        <span className="truncate max-w-[60%]">{stripTitleEmoji(board.title)}</span>
        <span><span className="font-semibold text-warm-text">{board.filledCount}</span>/{board.totalStickers}</span>
      </div>
    </div>
  );

  // 수확 완료 멤버 코너 배지(REQ13) — '완료'와 구분되는 와인색 표식.
  const harvestBadge = (
    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-juice-100 text-juice-700 text-[10px] font-semibold">
      <EmojiIcon emoji="🍷" size={12} /> 수확 완료
    </span>
  );

  // 탭 가능 멤버 카드의 우측 chevron — '눌러서 이동' 시각 단서(의미론은 button이 이미 제공).
  // 세로 중앙이라 top-2.5의 수확 배지와 안 겹친다(수확 배지는 board가 있을 때만 → 카드가 충분히 큼).
  const tapChevron = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-sub"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
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
      <div className="clay-sm p-4 mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${isGroup ? 'bg-leaf-100 text-leaf-700' : 'bg-grape-100 text-grape-600'}`}>
            {isGroup ? '그룹' : '릴레이'}
          </span>
          <p className="text-xs text-warm-sub mt-1.5 truncate">만든이 {relay.creator.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-bold text-warm-text tabular-nums leading-tight">{relay.participants.length}명</p>
          <p className="text-xs text-warm-sub tabular-nums">{relay.totalStickers}알</p>
        </div>
      </div>

      {/* 초대 수락/거절 배너(REQ10) */}
      {myInvited && (
        <div className="clay p-5 mb-6 bg-grape-50 text-center">
          <EmojiIcon emoji="🔗" size={32} className="block mx-auto mb-2" />
          <p className="font-bold text-grape-700 mb-1">포도동에 초대받았어요</p>
          <p className="text-sm text-warm-sub mb-4 text-balance">{relay.creator.name}님이 함께 습관을 채우자고 초대했어요</p>
          <div className="flex gap-3">
            <ClayButton variant="ghost" fullWidth onClick={() => setConfirmDecline(true)} disabled={responding}>거절</ClayButton>
            <ClayButton fullWidth size="lg" onClick={handleAccept} loading={responding}>수락하기</ClayButton>
          </div>
        </div>
      )}

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
          /* 그룹: 병렬 멤버 카드 — 탭하면 해당 포도판으로 이동, 실시간 포도알 미리보기 */
          <div className="space-y-3">
            {relay.participants.map((p) => {
              const harvested = !!p.board?.harvestedAt;
              const done = p.status === 'completed' || p.board?.isCompleted;
              const tappable = !!p.boardId;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!tappable}
                  onClick={() => { if (p.boardId) { feedbackTap(); router.push(`/board/${p.boardId}`); } }}
                  className={`relative block w-full text-left p-4 rounded-2xl ${done ? 'clay bg-leaf-100/40' : 'clay-sm'} ${harvested ? 'opacity-75' : ''} ${tappable ? 'pr-9 active:scale-[0.98] transition-transform' : 'cursor-default'}`}
                >
                  {harvested && harvestBadge}
                  {tappable && tapChevron}
                  <div className="flex items-center gap-3">
                    <Avatar avatar={p.user.avatar} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-warm-text">
                        {p.user.name}
                        {p.userId === user?.id && <span className="text-xs text-grape-400 ml-1">(나)</span>}
                      </p>
                      {p.status === 'invited' ? (
                        <p className="text-xs text-warm-sub">초대 대기중</p>
                      ) : p.id === firstFinisherId ? (
                        <p className="text-xs font-semibold text-sunshine-700">1등 완성!</p>
                      ) : done && !harvested ? (
                        <p className="text-xs text-leaf-700 font-medium">완료</p>
                      ) : null}
                    </div>
                  </div>
                  {p.board ? miniGrapes(p.board) : (
                    <p className="text-xs text-warm-sub mt-3">{p.status === 'invited' ? '초대를 수락하면 시작할 수 있어요' : '아직 포도판을 시작하지 않았어요'}</p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* 릴레이: 세로 턴 타임라인 — 카드 탭하면 포도판으로 이동 */
          <div className="relative">
            {relay.participants.map((p, idx) => {
              const statusInfo = participantStatusLabel(p.status);
              const isActive = p.status === 'active';
              const isCompleted = p.status === 'completed';
              const isLast = idx === relay.participants.length - 1;
              const harvested = !!p.board?.harvestedAt;
              const tappable = !!p.boardId;
              return (
                <div key={p.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${isCompleted ? 'bg-grape-500' : isActive ? 'bg-grape-400 ring-4 ring-grape-200 animate-pulse' : 'bg-warm-border'}`} />
                    {!isLast && <div className={`w-0.5 h-16 ${isCompleted ? 'bg-grape-400' : 'bg-warm-border'}`} />}
                  </div>
                  <button
                    type="button"
                    disabled={!tappable}
                    onClick={() => { if (p.boardId) { feedbackTap(); router.push(`/board/${p.boardId}`); } }}
                    className={`relative flex-1 mb-3 p-4 rounded-2xl text-left ${isActive ? 'clay bg-grape-50 ring-2 ring-grape-300' : 'clay-sm'} ${harvested ? 'opacity-75' : ''} ${tappable ? 'pr-9 active:scale-[0.98] transition-transform' : 'cursor-default'}`}
                  >
                    {harvested && harvestBadge}
                    {tappable && tapChevron}
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
                    {p.board && miniGrapes(p.board)}
                  </button>
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

      {/* Join: 수락한 참가자인데 아직 보드 없음 */}
      {needsToJoin && !isGroup && (
        <ClayButton fullWidth size="lg" onClick={() => handleJoin()} loading={joining}>
          새 포도판으로 참여하기
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
          <p className="text-sm text-warm-sub text-balance">완성하면 다음 주자에게 자동으로 넘어가요</p>
        </div>
      )}

      {/* 기존 포도판 불러오기 모달(그룹) */}
      {attachOpen && (
        <Modal
          onClose={() => setAttachOpen(false)}
          label="기존 포도판 불러오기"
          backdropClassName="z-90 bg-black/40 backdrop-blur-xs"
          sheetClassName="w-full max-w-lg bg-clay-bg rounded-t-[28px] clay-float p-5 pb-8 safe-bottom max-h-[75vh] flex flex-col"
        >
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
        </Modal>
      )}

      {/* 초대 거절 확인 — 거절은 참가자에서 영구 제외되어 다시 초대받아야 함 */}
      <ConfirmDialog
        open={confirmDecline}
        title="초대를 거절할까요?"
        description="거절하면 이 포도동에서 빠지고, 다시 참여하려면 새로 초대받아야 해요."
        confirmLabel="거절"
        destructive
        loading={responding}
        onConfirm={handleDecline}
        onCancel={() => { if (!responding) setConfirmDecline(false); }}
      />
    </div>
  );
}
