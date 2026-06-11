'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import EmojiIcon from './EmojiIcon';
import { feedbackTap } from '@/lib/feedback';

/**
 * 홈 헤더의 알림 종 — 미읽음 배지를 보여주고 인박스로 이동.
 * 카운트는 store.unreadCount(통합 알림 피드 기준 단일 계약)를 구독하므로
 * 네비 '더보기' 탭·더보기 '알림함' 배지와 항상 같은 숫자를 보여준다.
 * 갱신 트리거(라우트 전환·탭 복귀·포커스)는 (app) 레이아웃의 <UnreadSync />가
 * 전역으로 소유한다 — 여기엔 fetch 로직을 다시 추가하지 말 것(이중 fetch).
 */
export default function NotificationBell() {
  const router = useRouter();
  const count = useAppStore((s) => s.unreadCount);

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
