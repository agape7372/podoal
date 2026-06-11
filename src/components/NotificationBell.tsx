'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { refreshUnreadCount } from '@/lib/notifications';
import EmojiIcon from './EmojiIcon';
import { feedbackTap } from '@/lib/feedback';

/**
 * 홈 헤더의 알림 종 — 미읽음 배지를 보여주고 인박스로 이동.
 * 카운트는 store.unreadCount(통합 알림 피드 기준 단일 계약)를 구독하므로
 * 네비 '더보기' 탭·더보기 '소통' 배지와 항상 같은 숫자를 보여준다.
 */
export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const count = useAppStore((s) => s.unreadCount);

  // 라우트 전환마다 재조회(인박스에서 읽고 돌아오면 배지 갱신).
  useEffect(() => { refreshUnreadCount(); }, [pathname]);

  // 탭이 다시 보이거나 창에 포커스될 때 재조회 — 체류 중 도착한 응원·초대·보상을 즉시 반영
  // (마운트 1회만 fetch하던 탓에 앱을 켜둔 채로는 새 알림이 안 뜨던 문제).
  // visibilitychange와 focus가 동시에 발화해도 refreshUnreadCount 내부 1.5초 스로틀이
  // 중복 fetch를 걸러낸다.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUnreadCount(); };
    const onFocus = () => { refreshUnreadCount(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
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
