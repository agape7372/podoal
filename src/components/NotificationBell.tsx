'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import EmojiIcon from './EmojiIcon';
import { feedbackTap } from '@/lib/feedback';
import type { NotificationEvent } from '@/types';

/** 홈 헤더의 알림 종 — 통합 피드의 미읽음 수 배지를 보여주고 인박스로 이동. */
export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    api<{ events: NotificationEvent[] }>('/api/notifications')
      .then((d) => setCount(d.events.filter((e) => !e.read).length))
      .catch(() => {});
  }, []);

  return (
    <button
      onClick={() => { feedbackTap(); router.push('/notifications/inbox'); }}
      aria-label={count > 0 ? `알림 ${count}개` : '알림'}
      className="relative w-11 h-11 rounded-full clay-button grid place-items-center shrink-0"
    >
      <EmojiIcon emoji="🔔" size={22} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-grape-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center tabular-nums border-[1.5px] border-warm-text">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
