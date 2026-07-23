'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { invalidateCachedApi } from '@/lib/cachedApi';
import { useCachedApi } from '@/lib/cachedApi';
import { useAppStore } from '@/lib/store';
import { countUnread } from '@/lib/notifications';
import Avatar from '@/components/Avatar';
import EmojiIcon from '@/components/EmojiIcon';
import EmptyState from '@/components/EmptyState';
import RetryButton from '@/components/RetryButton';
import { feedbackTap } from '@/lib/feedback';
import type { NotificationEvent } from '@/types';

// F8: react-hooks/purity — 렌더 중 Date.now() 호출 금지. now는 데이터 도착 시점에
// 캡처된 시각을 호출부(fetchedAt)에서 받는다(home/page.tsx:680 패턴).
function timeAgo(iso: string, now: number): string {
  const diffMin = Math.floor((now - new Date(iso).getTime()) / 60000);
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
  const { data, loading, error, refresh, mutate, validated } = useCachedApi<{ events: NotificationEvent[] }>('/api/notifications');
  const events = data?.events ?? [];

  // 방금 받은 피드가 곧 배지의 단일 출처 — 추가 fetch 없이 store를 같은 값으로 동기화
  // (인박스에 머무는 동안 네비 '더보기' 배지도 일치).
  useEffect(() => {
    if (data) setUnreadCount(countUnread(data.events));
  }, [data, setUnreadCount]);

  // F8: 상대시간 기준 시각 — 데이터 도착 시점에 고정(home/page.tsx:680 패턴).
  const [fetchedAt, setFetchedAt] = useState(0);
  useEffect(() => {
    if (data) setFetchedAt(new Date().getTime());
  }, [data]);

  // 알림함을 '열어서 봤으면' 응원·축하·선물 메시지는 읽음으로 간주 — 메시지함에서
  // 카드를 또 일일이 탭해야 배지가 안 빠지던 불일치를 해소한다(보상/친구요청/초대는
  // 수락·개봉 등 별도 처리가 필요하므로 그대로 둔다). 마운트당 1회만 발사.
  // 성공 후 피드·배지는 로컬 반영(mutate + countUnread) — 예전엔 refresh()+
  // refreshUnreadCount(force)로 같은 5쿼리 집계를 2번 더 받아왔다(스켈레톤 감사:
  // 인박스 1회 방문 = 동일 피드 3중 fetch). 서버 확정값과의 수렴은 다음
  // 마운트/복귀 재검증이 보장한다.
  const markedRef = useRef(false);
  useEffect(() => {
    if (markedRef.current) return;
    // 피드가 도착한 뒤 1회 — mount GET(5쿼리 집계, 느림)과 POST(단건 UPDATE, 빠름)를
    // 동시에 띄우면 커밋 전 스냅샷을 읽은 GET이 나중에 도착해 mutate를 미읽음 상태로
    // 되덮는 역전 경쟁이 '일반 케이스'가 된다. 콜드 캐시(prev=undefined)에서 mutate가
    // no-op 되는 문제도 같이 사라진다.
    // validated 게이트(정합 감사 추가) — 웜 캐시 mount는 data가 즉시 채워져도 이번
    // mount의 재검증(GET)이 아직 끝나기 전이라, data===undefined만으로는 위에서 말한
    // "mount GET과 POST 역전"을 못 막는다. validated(=fetched)까지 함께 봐서, 이번
    // mount의 GET이 실제로 완료된 뒤에만 read-all POST를 쏜다.
    if (!validated || data === undefined) return;
    markedRef.current = true;
    api('/api/messages/read-all', { method: 'POST' })
      .then(() => {
        invalidateCachedApi('/api/messages'); // 메시지함 재진입 시 읽음 상태 반영
        // 배지는 별도 호출 불필요 — 위 39행 effect가 data 변경을 감지해
        // countUnread로 동기화한다(업데이터는 순수 함수로 유지).
        mutate((prev) => {
          if (!prev) return prev;
          return {
            events: prev.events.map((e) =>
              e.type === 'cheer' || e.type === 'celebration' || e.type === 'gift'
                ? { ...e, read: true }
                : e,
            ),
          };
        });
      })
      .catch(() => {}); // 실패해도 다음 진입에서 재시도(멱등)
  }, [data, mutate, validated]);

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
          <RetryButton onRetry={refresh} />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          art="/illustrations/empty/empty-inbox-v1.webp"
          fallbackEmoji="🔔"
          artSize={96}
          title="아직 알림이 없어요"
          description="응원·보상·친구 요청·포도동 초대·깜짝 선물이 도착하면 여기에 모여요"
        />
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => open(e)}
              className={`w-full clay-sm p-4 text-left flex items-start gap-3 transition-[transform,opacity,box-shadow] active:scale-[0.98] ${
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
                <p className="text-xs text-warm-sub mt-1">{timeAgo(e.createdAt, fetchedAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
