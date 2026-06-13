'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCachedApi } from '@/lib/cachedApi';
import { useAppStore } from '@/lib/store';
import { refreshUnreadCount } from '@/lib/notifications';
import Avatar from '@/components/Avatar';
import EmojiIcon from '@/components/EmojiIcon';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { MessageInfo } from '@/types';

export default function MessagesPage() {
  // SWR 캐시: 재방문 시 직전 목록으로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, refresh, mutate } = useCachedApi<MessageInfo[]>('/api/messages');
  const messages = data ?? [];
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 배지는 통합 알림 피드 기준 단일 계약 — 메시지만의 로컬 계산으로 덮지 않고
  // 피드 도착 시 서버값으로 동기화한다(refreshUnreadCount가 store.unreadCount 갱신, 스로틀 있음).
  useEffect(() => {
    if (data) refreshUnreadCount();
  }, [data]);

  // 실시간 반영: 메시지함에 머무는 중 SSE로 새 메시지가 도착하면 store.messages에
  // prepend된다(useSSE의 addMessage). 그 분을 캐시 목록에 병합해, 나갔다 들어오거나
  // 포커스를 줄 필요 없이 즉시 보이게 한다. id 기준 dedup(이미 있으면 무시).
  const liveMessages = useAppStore((s) => s.messages);
  useEffect(() => {
    if (liveMessages.length === 0) return;
    mutate((prev) => {
      if (!prev) return prev;
      const have = new Set(prev.map((m) => m.id));
      const fresh = liveMessages.filter((m) => !have.has(m.id));
      return fresh.length === 0 ? prev : [...fresh, ...prev];
    });
  }, [liveMessages, mutate]);

  const handleMarkRead = async (id: string) => {
    const target = messages.find((m) => m.id === id);
    if (!target || target.isRead) return;
    // Optimistic: mark read immediately, roll back if the request fails so the
    // UI never claims "read" when the server didn't record it (previously the
    // PATCH was awaited first and a failure left the click with no feedback).
    mutate((prev) =>
      prev?.map((m) => (m.id === id ? { ...m, isRead: true } : m))
    );
    try {
      await api(`/api/messages/${id}`, { method: 'PATCH', json: {} });
      // 서버 반영이 끝난 뒤 배지를 피드 기준으로 동기화(force: 스로틀 우회).
      refreshUnreadCount({ force: true });
    } catch {
      mutate((prev) =>
        prev?.map((m) => (m.id === id ? { ...m, isRead: false } : m))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const removed = messages[idx];
    // Optimistic: remove immediately; restore at the original index on failure.
    mutate((prev) => prev?.filter((m) => m.id !== id));
    try {
      await api(`/api/messages/${id}`, { method: 'DELETE' });
      // 서버 반영이 끝난 뒤 배지를 피드 기준으로 동기화(force: 스로틀 우회).
      refreshUnreadCount({ force: true });
    } catch {
      mutate((prev) => {
        if (!prev) return undefined;
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, removed);
        return next;
      });
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}일 전`;
    return d.toLocaleDateString('ko-KR');
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'cheer': return '응원';
      case 'celebration': return '축하';
      case 'gift': return '선물';
      default: return '';
    }
  };

  const typeBg = (type: string) => {
    switch (type) {
      case 'cheer': return 'bg-grape-50/60';
      case 'celebration': return 'bg-amber-50/60';
      case 'gift': return 'bg-pink-50/60';
      default: return '';
    }
  };

  return (
    <div className="pb-4">
      {/* 받은 보상의 정식 진입점은 포도밭(/rewards, 더보기 > 나의 기록) — 이 페이지는 메시지만 담당한다. */}
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-4 inline-flex items-center gap-1.5"><EmojiIcon emoji="💌" size={24} /> 소통</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={refresh} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16">
          <EmojiIcon emoji="💌" size={52} className="block mx-auto mb-4" />
          <p className="text-warm-sub">아직 메시지가 없어요</p>
          <p className="text-xs text-warm-sub mt-1">친구에게 응원을 보내보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="relative">
              <button
                onClick={() => !msg.isRead && handleMarkRead(msg.id)}
                className={`
                  w-full clay-sm p-4 pr-11 text-left transition-all
                  ${typeBg(msg.type)}
                  ${!msg.isRead ? 'ring-2 ring-grape-300/50' : 'opacity-80'}
                `}
              >
                <div className="flex items-start gap-3">
                  <Avatar avatar={msg.sender.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-warm-text">
                        {msg.sender.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-grape-100 text-grape-600">
                        {typeLabel(msg.type)}
                      </span>
                      {!msg.isRead && (
                        <span className="w-2 h-2 rounded-full bg-grape-500" />
                      )}
                    </div>
                    <p className="text-sm text-warm-text">
                      <EmojiIcon emoji={msg.emoji} size={16} className="mr-1" />
                      {msg.content}
                    </p>
                    <p className="text-xs text-warm-sub mt-1">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
              {/* 삭제 버튼은 카드 button의 형제(중첩 X) — 클릭이 markRead로 버블되지 않는다. */}
              <button
                onClick={() => setConfirmDeleteId(msg.id)}
                aria-label="메시지 삭제"
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-warm-sub hover:text-rose-500 hover:bg-rose-50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="메시지를 삭제할까요?"
        description="삭제한 메시지는 복구할 수 없어요."
        confirmLabel="삭제"
        destructive
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) handleDelete(id);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
