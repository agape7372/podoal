'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import Avatar from '@/components/Avatar';
import type { MessageInfo } from '@/types';

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const setUnreadCount = useAppStore((s) => s.setUnreadCount);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api<MessageInfo[]>('/api/messages');
      setMessages(data);
      const unread = data.filter((m: MessageInfo) => !m.isRead).length;
      setUnreadCount(unread);
    } catch {}
    setLoading(false);
  }, [setUnreadCount]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleMarkRead = async (id: string) => {
    await api(`/api/messages/${id}`, { method: 'PATCH', json: {} });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
    );
    setUnreadCount(messages.filter((m) => !m.isRead && m.id !== id).length);
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
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">💌 메시지</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">💌</span>
          <p className="text-warm-sub">아직 메시지가 없어요</p>
          <p className="text-xs text-warm-light mt-1">친구에게 응원을 보내보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => !msg.isRead && handleMarkRead(msg.id)}
              className={`
                w-full clay-sm p-4 text-left transition-all
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
                    <span className="mr-1">{msg.emoji}</span>
                    {msg.content}
                  </p>
                  <p className="text-[10px] text-warm-light mt-1">
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
