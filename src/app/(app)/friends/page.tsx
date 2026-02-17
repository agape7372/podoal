'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import FriendCard from '@/components/FriendCard';
import CheerModal from '@/components/CheerModal';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import type { FriendInfo } from '@/types';

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pending, setPending] = useState<FriendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [cheerTarget, setCheerTarget] = useState<{ id: string; name: string } | null>(null);
  const [tab, setTab] = useState<'friends' | 'favorite'>('friends');

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api<{ friends: FriendInfo[]; pendingRequests: FriendInfo[] }>('/api/friends');
      setFriends(data.friends || []);
      setPending(data.pendingRequests || []);
    } catch {}
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
      setAddSuccess('친구 요청을 보냈어요!');
      setAddEmail('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '요청 실패');
    }
    setAdding(false);
  };

  const handleAccept = async (id: string) => {
    await api(`/api/friends/${id}`, { method: 'PATCH', json: { action: 'accept' } });
    fetchFriends();
  };

  const handleToggleFavorite = async (id: string) => {
    await api(`/api/friends/${id}`, { method: 'PATCH', json: { action: 'favorite' } });
    fetchFriends();
  };

  const handleRemove = async (id: string) => {
    if (!confirm('정말 삭제할까요?')) return;
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
      <h1 className="text-2xl font-bold text-grape-700 mb-6">👥 친구</h1>

      {/* Add friend */}
      <div className="clay p-4 mb-6 bg-gradient-to-br from-white to-clay-lavender/20">
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
        {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
        {addSuccess && <p className="text-green-500 text-xs mt-2">{addSuccess}</p>}
      </div>

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
          onClick={() => setTab('friends')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'friends' ? 'clay-pressed text-grape-600' : 'clay-button text-warm-sub'
          }`}
        >
          전체 ({friends.length})
        </button>
        <button
          onClick={() => setTab('favorite')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'favorite' ? 'clay-pressed text-grape-600' : 'clay-button text-warm-sub'
          }`}
        >
          ⭐ 즐겨찾기
        </button>
      </div>

      {/* Friend list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">{tab === 'favorite' ? '⭐' : '👥'}</span>
          <p className="text-warm-sub">
            {tab === 'favorite' ? '즐겨찾기한 친구가 없어요' : '아직 친구가 없어요'}
          </p>
          <p className="text-xs text-warm-light mt-1">이메일로 친구를 추가해 보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((f) => (
            <FriendCard
              key={f.id}
              friend={f}
              onToggleFavorite={handleToggleFavorite}
              onRemove={handleRemove}
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
    </div>
  );
}
