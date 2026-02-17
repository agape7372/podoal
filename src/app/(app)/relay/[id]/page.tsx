'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import ClayButton from '@/components/ClayButton';
import Avatar from '@/components/Avatar';
import type { RelayInfo } from '@/types';

interface RelayDetailParticipant {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatar: string };
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

  useEffect(() => {
    fetchRelay();
  }, [fetchRelay]);

  const handleJoin = async () => {
    setJoining(true);
    setMessage('');
    try {
      await api(`/api/relays/${relayId}/join`, { method: 'POST' });
      setMessage('릴레이에 참여했어요!');
      await fetchRelay();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '참여에 실패했어요');
    }
    setJoining(false);
  };

  const handlePass = async () => {
    setPassing(true);
    setMessage('');
    try {
      const data = await api<{ message: string; relayCompleted: boolean }>(
        `/api/relays/${relayId}/pass`,
        { method: 'POST' }
      );
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!relay) return null;

  const myParticipant = relay.participants.find((p) => p.userId === user?.id);
  const isMyTurn = myParticipant?.status === 'active';
  const hasBoard = !!myParticipant?.boardId;
  const myBoardCompleted = myParticipant?.board?.isCompleted ?? false;
  const needsToJoin = myParticipant && !myParticipant.boardId;
  const isRelayCompleted = relay.status === 'completed';

  const statusBadge = isRelayCompleted
    ? { text: '완료', color: 'bg-green-100 text-green-600' }
    : { text: '진행중', color: 'bg-grape-100 text-grape-600' };

  const participantStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return { text: '완료', color: 'bg-green-100 text-green-600' };
      case 'active':
        return { text: '진행중', color: 'bg-grape-100 text-grape-600' };
      default:
        return { text: '대기중', color: 'bg-gray-100 text-gray-500' };
    }
  };

  return (
    <div className="pb-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/relay')}
        className="clay-button px-3 py-2 rounded-xl text-sm text-warm-sub mb-4"
      >
        {'\u2190'} 릴레이 목록
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-grape-700">{relay.title}</h1>
        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusBadge.color}`}>
          {statusBadge.text}
        </span>
      </div>

      {/* Info */}
      <div className="clay-sm p-4 mb-6 bg-gradient-to-br from-clay-lavender/30 to-white">
        <div className="flex items-center gap-4 text-sm text-warm-sub">
          <span>{relay.totalStickers}알</span>
          <span>|</span>
          <span>{relay.participants.length}명 참여</span>
          <span>|</span>
          <span>만든이: {relay.creator.name}</span>
        </div>
      </div>

      {/* Relay completed celebration */}
      {isRelayCompleted && (
        <div className="clay p-6 mb-6 bg-gradient-to-br from-clay-yellow/40 to-clay-peach/30 text-center">
          <div className="text-4xl mb-2">{'\uD83C\uDF89'}</div>
          <p className="font-bold text-grape-700 text-lg mb-1">릴레이 완료!</p>
          <p className="text-sm text-warm-sub">
            모든 참가자가 포도판을 완성했어요. 모두 수고했어요!
          </p>
        </div>
      )}

      {/* Chain visualization - vertical timeline */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-warm-sub mb-4">참가자 현황</h2>
        <div className="relative">
          {relay.participants.map((p, idx) => {
            const statusInfo = participantStatusLabel(p.status);
            const isActive = p.status === 'active';
            const isCompleted = p.status === 'completed';
            const isLast = idx === relay.participants.length - 1;

            return (
              <div key={p.id} className="flex items-start gap-4">
                {/* Vertical line + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      isCompleted
                        ? 'bg-grape-500'
                        : isActive
                        ? 'bg-grape-400 ring-4 ring-grape-200 animate-pulse'
                        : 'bg-gray-300'
                    }`}
                  />
                  {!isLast && (
                    <div
                      className={`w-0.5 h-16 ${
                        isCompleted ? 'bg-grape-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>

                {/* Participant card */}
                <div
                  className={`flex-1 mb-3 p-4 rounded-2xl transition-all ${
                    isActive
                      ? 'clay bg-gradient-to-br from-grape-50 to-clay-lavender/30 ring-2 ring-grape-300'
                      : 'clay-sm bg-gradient-to-br from-white to-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar avatar={p.user.avatar} size="md" />
                      <div>
                        <p className="font-semibold text-warm-text">
                          {p.user.name}
                          {p.userId === user?.id && (
                            <span className="text-xs text-grape-400 ml-1">(나)</span>
                          )}
                        </p>
                        <p className="text-xs text-warm-light">
                          {p.order === 0 ? '첫 번째' : `${p.order + 1}번째`} 주자
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusInfo.color}`}
                    >
                      {statusInfo.text}
                    </span>
                  </div>

                  {/* Board progress for this participant */}
                  {p.board && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-warm-sub mb-1">
                        <span>{p.board.title}</span>
                        <span>
                          {p.board.filledCount}/{p.board.totalStickers}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-grape-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-grape-300 to-grape-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(p.board.filledCount / p.board.totalStickers) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Show board link if it's my turn */}
                  {p.userId === user?.id && isActive && p.boardId && (
                    <div className="mt-3">
                      <ClayButton
                        size="sm"
                        variant={myBoardCompleted ? 'secondary' : 'primary'}
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/board/${p.boardId}`);
                        }}
                      >
                        {myBoardCompleted
                          ? '내 포도판 보기'
                          : '내 포도판으로 이동'}
                      </ClayButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action area */}
      {message && (
        <div className="clay-sm p-3 mb-4 bg-gradient-to-br from-clay-peach/30 to-white text-center">
          <p className="text-sm text-warm-text">{message}</p>
        </div>
      )}

      {/* Join button: if I'm a participant but haven't joined yet (no board) */}
      {needsToJoin && (
        <ClayButton fullWidth size="lg" onClick={handleJoin} loading={joining}>
          릴레이 참여하기
        </ClayButton>
      )}

      {/* Pass baton button: if it's my turn and my board is completed */}
      {isMyTurn && hasBoard && myBoardCompleted && (
        <ClayButton fullWidth size="lg" onClick={handlePass} loading={passing}>
          {'\uD83C\uDFC3'} 바통 넘기기
        </ClayButton>
      )}

      {/* Info: if it's my turn but board is not completed */}
      {isMyTurn && hasBoard && !myBoardCompleted && (
        <div className="clay-sm p-4 text-center bg-gradient-to-br from-grape-50 to-clay-lavender/20">
          <p className="text-sm text-warm-sub">
            포도판을 완성하면 다음 참가자에게 바통을 넘길 수 있어요!
          </p>
        </div>
      )}
    </div>
  );
}
