'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { feedbackTap } from '@/lib/feedback';

const menuItems = [
  { path: '/friends', icon: '👥', label: '친구', color: 'bg-pink-50/60' },
  { path: '/messages', icon: '💌', label: '메시지', color: 'bg-grape-50/60', badge: 'unread' },
  { path: '/stats', icon: '📊', label: '통계', color: 'bg-emerald-50/60' },
  { path: '/vine', icon: '🌿', label: '포도덩쿨', color: 'bg-amber-50/60' },
  { path: '/sound-test', icon: '🔊', label: '효과음', color: 'bg-amber-50/60' },
  { path: '/animation-test', icon: '🎬', label: '애니메이션', color: 'bg-grape-50/60' },
  { path: '/settings', icon: '⚙️', label: '설정', color: 'bg-orange-50/60' },
  { path: '/notifications', icon: '🔔', label: '알림 설정', color: 'bg-grape-50/60' },
];

export default function MorePage() {
  const router = useRouter();
  const unreadCount = useAppStore((s) => s.unreadCount);

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">더보기</h1>

      <div className="grid grid-cols-3 gap-3">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => { feedbackTap(); router.push(item.path); }}
            className={`clay-sm p-4 text-center ${item.color} transition-all active:scale-[0.97]`}
          >
            <span className="text-3xl relative inline-block">
              {item.icon}
              {item.badge === 'unread' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-grape-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <p className="text-xs font-medium text-warm-text mt-2">{item.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
