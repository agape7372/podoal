'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { feedbackTap } from '@/lib/feedback';

const navItems = [
  { path: '/home', icon: '🏠', label: '홈' },
  { path: '/board/create', icon: '🍇', label: '만들기' },
  { path: '/relay', icon: '🔗', label: '릴레이' },
  { path: '/winery', icon: '🍷', label: '와이너리' },
  { path: '/more', icon: '☰', label: '더보기', badge: 'unread' },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const unreadCount = useAppStore((s) => s.unreadCount);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-warm-border/50 bottom-nav">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => { feedbackTap(); router.push(item.path); }}
              className={`
                flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl no-select
                transition-all duration-200
                ${isActive
                  ? 'text-grape-600 scale-110'
                  : 'text-warm-sub hover:text-grape-400'
                }
              `}
            >
              <span className="text-xl relative">
                {item.icon}
                {item.badge === 'unread' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
