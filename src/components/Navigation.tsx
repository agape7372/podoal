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
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none bottom-nav">
      <div className="max-w-lg mx-auto px-3 pb-2">
        <div
          className="pointer-events-auto clay-puffy bg-white/95 backdrop-blur-md flex items-center justify-around py-2 px-1"
          style={{ borderRadius: '28px' }}
        >
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  feedbackTap();
                  router.push(item.path);
                }}
                className={`
                  relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl no-select
                  transition-all duration-200
                  ${isActive ? 'text-warm-text' : 'text-warm-sub hover:text-warm-text'}
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator dot */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-[1.5px] border-warm-text transition-all duration-200 ${
                    isActive ? 'bg-grape-500 opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-xl relative">
                  {item.icon}
                  {item.badge === 'unread' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-grape-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-[1.5px] border-warm-text">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className={`text-[10.5px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
