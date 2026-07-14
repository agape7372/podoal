'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCachedApi } from '@/lib/cachedApi';
import FriendCard from '@/components/FriendCard';
import CheerModal from '@/components/CheerModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ClayInput from '@/components/ClayInput';
import Avatar from '@/components/Avatar';
import EmojiIcon from '@/components/EmojiIcon';
import EmptyState from '@/components/EmptyState';
import PodongList from '@/components/PodongList';
import RetryButton from '@/components/RetryButton';
import type { FriendInfo, SearchedUser } from '@/types';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { track } from '@/lib/analytics';
import { DEV_TOOLS } from '@/lib/devtools';

export default function FriendsPage() {
  const router = useRouter();
  // SWR 캐시: 재방문 시 직전 친구 목록으로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, refresh, mutate } = useCachedApi<{
    friends: FriendInfo[];
    pendingRequests: FriendInfo[];
  }>('/api/friends');
  const friends = data?.friends ?? [];
  const pending = data?.pendingRequests ?? [];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [cheerTarget, setCheerTarget] = useState<{ id: string; name: string } | null>(null);
  const [tab, setTab] = useState<'friends' | 'favorite' | 'podong'>('friends');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedInfo, setSeedInfo] = useState('');

  const fetchFriends = refresh;

  // 디바운스 닉네임/이름 검색. 경합은 AbortController로 취소.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearchError(''); setSearching(false); return; }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await api<SearchedUser[]>(
          `/api/friends/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        setResults(data);
        setSearchError('');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setSearchError(e instanceof Error ? e.message : '검색에 실패했어요');
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const handleRequest = async (u: SearchedUser) => {
    setRequested((prev) => new Set(prev).add(u.id)); // optimistic '요청됨'
    setSearchError('');
    try {
      await api('/api/friends', { method: 'POST', json: { targetId: u.id } });
      feedbackSuccess();
    } catch (e) {
      setRequested((prev) => { const n = new Set(prev); n.delete(u.id); return n; });
      setSearchError(e instanceof Error ? e.message : '친구 요청에 실패했어요');
    }
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
    track('friend_accepted'); // 소셜 KPI(§3-3) — 관계 이벤트, 속성 없음
    fetchFriends();
  };

  const handleToggleFavorite = async (id: string) => {
    // Optimistic: flip locally so the star reacts instantly. We deliberately do
    // NOT re-fetch — re-fetching was both slow and reordered the just-favorited
    // friend to the bottom (the list API has no stable order). Roll back on error.
    const flip = (prev: typeof data) =>
      prev && { ...prev, friends: prev.friends.map((f) => (f.id === id ? { ...f, isFavorite: !f.isFavorite } : f)) };
    mutate(flip);
    try {
      await api(`/api/friends/${id}`, { method: 'PATCH', json: { action: 'favorite' } });
    } catch {
      mutate(flip);
    }
  };

  const handleRemove = (id: string) => {
    if (pending.some((p) => p.id === id)) {
      setRejectTarget(id);
    } else {
      setRemoveTarget(id);
    }
  };

  // Keep the dialog open with a spinner while the request is in flight (instead of
  // closing optimistically), so a slow delete gives feedback and can't be double-fired.
  const confirmRemove = async () => {
    if (!removeTarget || removing) return;
    const id = removeTarget;
    setRemoving(true);
    try {
      await api(`/api/friends/${id}`, { method: 'DELETE' });
      await fetchFriends();
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget || rejecting) return;
    const id = rejectTarget;
    setRejecting(true);
    try {
      await api(`/api/friends/${id}`, { method: 'DELETE' });
      await fetchFriends();
    } finally {
      setRejecting(false);
      setRejectTarget(null);
    }
  };

  const handleSendCheer = async (message: string, emoji: string) => {
    if (!cheerTarget) return;
    await api('/api/messages', {
      method: 'POST',
      json: { receiverId: cheerTarget.id, content: message, type: 'cheer', emoji },
    });
  };

  // Favorites float to the top; Array.sort is stable so order within each group
  // stays put across toggles (no more "favorited friend jumps to the bottom").
  const displayed = (tab === 'favorite' ? friends.filter((f) => f.isFavorite) : friends)
    .slice()
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6 inline-flex items-center gap-1.5"><EmojiIcon emoji="👥" size={24} /> 친구</h1>

      {/* Add friend — 이름/이메일 검색 (포도동 세그먼트에선 숨김) */}
      {tab !== 'podong' && (
      <div className="clay p-4 mb-6">
        <p className="text-sm font-medium text-warm-text mb-3">친구 추가하기</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-sub pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <ClayInput
            type="search"
            placeholder="이름 또는 이메일로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {searchError && <p className="text-rose-700 text-xs mt-2">{searchError}</p>}

        {query.trim() && (
          <div className="mt-3 space-y-2">
            {searching && results.length === 0 ? (
              <p className="text-xs text-warm-sub py-2">검색 중…</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-warm-sub py-2">검색 결과가 없어요. 이름을 다시 확인해 보세요.</p>
            ) : (
              results.map((u) => {
                const requestedNow = requested.has(u.id) || u.status === 'pending_sent';
                const label =
                  u.status === 'accepted' ? '친구'
                    : u.status === 'pending_received' ? '요청받음'
                      : requestedNow ? '요청됨'
                        : '친구요청';
                const disabled = u.status !== 'none' || requestedNow;
                return (
                  <div key={u.id} className="flex items-center gap-3 clay-sm p-2.5">
                    <Avatar avatar={u.avatar} size="md" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-warm-text truncate">{u.name}</span>
                    <button
                      onClick={() => !disabled && handleRequest(u)}
                      disabled={disabled}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        disabled ? 'text-warm-sub bg-warm-border/40' : 'text-white bg-grape-600 clay-button'
                      }`}
                    >
                      {label}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      )}

      {/* DEV-only: one-tap test friends + boards for experimenting with social features */}
      {DEV_TOOLS && tab !== 'podong' && (
        <div className="clay-sm p-3 mb-6 bg-amber-50/50 border border-amber-100">
          <button onClick={handleSeed} disabled={seeding} className="text-xs font-semibold text-grape-700">
            <EmojiIcon emoji="🧪" size={13} className="mr-0.5" />{seeding ? '만드는 중…' : '테스트 친구·보드 만들기 (개발용)'}
          </button>
          {seedInfo && (
            <p className="text-[11px] text-warm-sub mt-2 whitespace-pre-wrap break-all leading-relaxed">{seedInfo}</p>
          )}
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && tab !== 'podong' && (
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
        <button
          onClick={() => { feedbackTap(); setTab('podong'); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'podong' ? 'clay-pressed text-grape-600' : 'clay-button text-warm-sub'
          }`}
        >
          <span className="inline-flex items-center gap-1"><EmojiIcon emoji="🔗" size={14} /> 포도동</span>
        </button>
      </div>

      {/* Friend list / 포도동 */}
      {tab === 'podong' ? (
        <PodongList heading={false} />
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <RetryButton onRetry={fetchFriends} />
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          art={tab === 'favorite' ? '/illustrations/empty/empty-favorites-v2.webp' : '/illustrations/empty/empty-friends-v2.webp'}
          fallbackEmoji={tab === 'favorite' ? '⭐' : '👥'}
          artSize={80}
          title={tab === 'favorite' ? '즐겨찾기한 친구가 없어요' : '아직 친구가 없어요'}
          description="이름으로 친구를 검색해 보세요!"
        />
      ) : (
        <div className="space-y-2">
          {displayed.map((f, i) => (
            <div key={f.id} className="stagger-item" style={{ '--stagger-i': Math.min(i, 8) } as React.CSSProperties}>
              <FriendCard
                friend={f}
                onToggleFavorite={handleToggleFavorite}
                onRemove={handleRemove}
                onViewBoards={(userId) => router.push(`/friends/${userId}`)}
                onSendCheer={(userId) => {
                  setCheerTarget({ id: userId, name: f.user.name });
                }}
              />
            </div>
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
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => { if (!removing) setRemoveTarget(null); }}
      />

      {/* Reject request confirm */}
      <ConfirmDialog
        open={rejectTarget !== null}
        title="친구 요청을 거절할까요?"
        confirmLabel="거절"
        destructive
        loading={rejecting}
        onConfirm={confirmReject}
        onCancel={() => { if (!rejecting) setRejectTarget(null); }}
      />
    </div>
  );
}
