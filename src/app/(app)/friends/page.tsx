'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import FriendCard from '@/components/FriendCard';
import CheerModal from '@/components/CheerModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import EmojiIcon from '@/components/EmojiIcon';
import type { FriendInfo } from '@/types';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { DEV_TOOLS } from '@/lib/devtools';

export default function FriendsPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pending, setPending] = useState<FriendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [cheerTarget, setCheerTarget] = useState<{ id: string; name: string } | null>(null);
  const [tab, setTab] = useState<'friends' | 'favorite'>('friends');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedInfo, setSeedInfo] = useState('');

  const fetchFriends = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await api<{ friends: FriendInfo[]; pendingRequests: FriendInfo[] }>('/api/friends');
      setFriends(data.friends || []);
      setPending(data.pendingRequests || []);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    setAddError('');
    setAddSuccess('');
    try {
      await api('/api/friends', { method: 'POST', json: { email: addEmail.trim() } });
      feedbackSuccess();
      setAddSuccess('친구 요청을 보냈어요.');
      setAddEmail('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '요청 실패');
    }
    setAdding(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedInfo('');
    try {
      const res = await api<{ password: string; friends: { name: string; email: string }[] }>(
        '/api/dev/seed-friends',
        { method: 'POST' },
      );
      feedbackSuccess();
      setSeedInfo(
        `테스트 친구 ${res.friends.length}명 준비 완료! 받는 쪽도 보려면 아래 계정으로 로그인하세요 (비밀번호 ${res.password}):\n` +
          res.friends.map((f) => `· ${f.name} — ${f.email}`).join('\n'),
      );
      fetchFriends();
    } catch (e) {
      setSeedInfo(e instanceof Error ? e.message : '생성에 실패했어요');
    } finally {
      setSeeding(false);
    }
  };

  const handleAccept = async (id: string) => {
    await api(`/api/friends/${id}`, { method: 'PATCH', json: { action: 'accept' } });
    fetchFriends();
  };

  const handleToggleFavorite = async (id: string) => {
    await api(`/api/friends/${id}`, { method: 'PATCH', json: { action: 'favorite' } });
    fetchFriends();
  };

  const handleRemove = (id: string) => {
    if (pending.some((p) => p.id === id)) {
      setRejectTarget(id);
    } else {
      setRemoveTarget(id);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const id = removeTarget;
    setRemoveTarget(null);
    await api(`/api/friends/${id}`, { method: 'DELETE' });
    fetchFriends();
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const id = rejectTarget;
    setRejectTarget(null);
    await api(`/api/friends/${id}`, { method: 'DELETE' });
    fetchFriends();
  };

  const handleSendCheer = async (message: string, emoji: string) => {
    if (!cheerTarget) return;
    await api('/api/messages', {
      method: 'POST',
      json: { receiverId: cheerTarget.id, content: message, type: 'cheer', emoji },
    });
  };

  const displayed = tab === 'favorite'
    ? friends.filter((f) => f.isFavorite)
    : friends;

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6 inline-flex items-center gap-1.5"><EmojiIcon emoji="👥" size={24} /> 친구</h1>

      {/* Add friend */}
      <div className="clay p-4 mb-6">
        <p className="text-sm font-medium text-warm-text mb-3">친구 추가하기</p>
        <div className="flex gap-2">
          <ClayInput
            placeholder="이메일 주소 입력"
            type="email"
            value={addEmail}
            onChange={(e) => { setAddEmail(e.target.value); setAddError(''); setAddSuccess(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <ClayButton size="sm" onClick={handleAdd} loading={adding} className="shrink-0">
            추가
          </ClayButton>
        </div>
        {addError && <p className="text-grape-700 text-xs mt-2">{addError}</p>}
        {addSuccess && <p className="text-leaf-700 text-xs mt-2">{addSuccess}</p>}
      </div>

      {/* DEV-only: one-tap test friends + boards for experimenting with social features */}
      {DEV_TOOLS && (
        <div className="clay-sm p-3 mb-6 bg-amber-50/50 border border-amber-100">
          <button onClick={handleSeed} disabled={seeding} className="text-xs font-semibold text-grape-700">
            🧪 {seeding ? '만드는 중…' : '테스트 친구·보드 만들기 (개발용)'}
          </button>
          {seedInfo && (
            <p className="text-[11px] text-warm-sub mt-2 whitespace-pre-wrap break-all leading-relaxed">{seedInfo}</p>
          )}
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-warm-sub mb-3">
            받은 친구 요청 ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((f) => (
              <FriendCard
                key={f.id}
                friend={f}
                onAccept={handleAccept}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { feedbackTap(); setTab('friends'); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'friends' ? 'clay-pressed text-grape-600' : 'clay-button text-warm-sub'
          }`}
        >
          전체{loading ? '' : ` (${friends.length})`}
        </button>
        <button
          onClick={() => { feedbackTap(); setTab('favorite'); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'favorite' ? 'clay-pressed text-grape-600' : 'clay-button text-warm-sub'
          }`}
        >
          <span className="inline-flex items-center gap-1"><EmojiIcon emoji="⭐" size={14} /> 즐겨찾기</span>
        </button>
      </div>

      {/* Friend list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={fetchFriends} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12">
          <EmojiIcon emoji={tab === 'favorite' ? '⭐' : '👥'} size={40} className="block mx-auto mb-3" />
          <p className="text-warm-sub">
            {tab === 'favorite' ? '즐겨찾기한 친구가 없어요' : '아직 친구가 없어요'}
          </p>
          <p className="text-xs text-warm-sub mt-1">이메일로 친구를 추가해 보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((f) => (
            <FriendCard
              key={f.id}
              friend={f}
              onToggleFavorite={handleToggleFavorite}
              onRemove={handleRemove}
              onViewBoards={(userId) => router.push(`/friends/${userId}`)}
              onSendCheer={(userId) => {
                setCheerTarget({ id: userId, name: f.user.name });
              }}
            />
          ))}
        </div>
      )}

      {/* Cheer modal */}
      {cheerTarget && (
        <CheerModal
          recipientName={cheerTarget.name}
          onSend={handleSendCheer}
          onClose={() => setCheerTarget(null)}
        />
      )}

      {/* Remove friend confirm */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="친구를 삭제할까요?"
        description="삭제하면 서로의 포도판을 볼 수 없어요."
        confirmLabel="삭제"
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* Reject request confirm */}
      <ConfirmDialog
        open={rejectTarget !== null}
        title="친구 요청을 거절할까요?"
        confirmLabel="거절"
        destructive
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
