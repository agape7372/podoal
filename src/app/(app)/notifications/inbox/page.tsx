'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCachedApi } from '@/lib/cachedApi';
import { useAppStore } from '@/lib/store';
import { countUnread } from '@/lib/notifications';
import Avatar from '@/components/Avatar';
import EmojiIcon from '@/components/EmojiIcon';
import { feedbackTap } from '@/lib/feedback';
import type { NotificationEvent } from '@/types';

function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export default function NotificationInboxPage() {
  const router = useRouter();
  const setUnreadCount = useAppStore((s) => s.setUnreadCount);
  // SWR 캐시: 재방문 시 직전 피드로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, refresh } = useCachedApi<{ events: NotificationEvent[] }>('/api/notifications');
  const events = data?.events ?? [];

  // 방금 받은 피드가 곧 배지의 단일 출처 — 추가 fetch 없이 store를 같은 값으로 동기화
  // (인박스에 머무는 동안 네비 '더보기' 배지도 일치).
  useEffect(() => {
    if (data) setUnreadCount(countUnread(data.events));
  }, [data, setUnreadCount]);

  const open = (e: NotificationEvent) => {
    feedbackTap();
    router.push(e.url);
  };

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => { feedbackTap(); router.push('/home'); }}
          aria-label="홈"
          className="clay-button w-9 h-9 rounded-full flex items-center justify-center text-warm-sub shrink-0"
        >
          ←
        </button>
        <h1 className="font-display text-2xl font-bold text-grape-700 inline-flex items-center gap-1.5">
          <EmojiIcon emoji="🔔" size={22} /> 알림
        </h1>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">알림을 불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={refresh} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <EmojiIcon emoji="🔔" size={48} className="block mx-auto mb-4" />
          <p className="text-warm-sub">아직 알림이 없어요</p>
          <p className="text-xs text-warm-sub mt-1 text-balance">응원·보상·친구 요청·포도동 초대·깜짝 선물이 도착하면 여기에 모여요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => open(e)}
              className={`w-full clay-sm p-4 text-left flex items-start gap-3 transition-all active:scale-[0.98] ${
                !e.read ? 'ring-2 ring-grape-300/50' : 'opacity-80'
              }`}
            >
              {e.actor ? (
                <div className="relative shrink-0">
                  <Avatar avatar={e.actor.avatar} size="md" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white grid place-items-center clay-sm">
                    <EmojiIcon emoji={e.emoji} size={12} />
                  </span>
                </div>
              ) : (
                <span className="w-10 h-10 rounded-full bg-grape-50 grid place-items-center shrink-0">
                  <EmojiIcon emoji={e.emoji} size={20} />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-warm-text">{e.title}</span>
                  {!e.read && <span className="w-2 h-2 rounded-full bg-grape-500 shrink-0" />}
                </div>
                <p className="text-sm text-warm-sub truncate">{e.body}</p>
                <p className="text-xs text-warm-sub mt-1">{timeAgo(e.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
