'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { feedbackTap } from '@/lib/feedback';

// Color-illustration icons (Microsoft Fluent Emoji, MIT) — unified with the
// profile grape (/avatars/grape.svg, 아바타 공용이라 탭이 없어도 자산은 유지).
// 만들기 진입은 홈 FAB(+) 전담 — 탭에서 제거해 4탭 구성.
// `owns`: 각 탭이 소유하는 라우트 prefix 목록. 가장 긴(구체적) 매치가 활성탭이 되어
// /board/* (create 포함) → 홈, 더보기 하위 7개 → 더보기로 귀속된다.
const navItems = [
  { path: '/home', icon: '/icons/nav/home.svg', label: '홈', owns: ['/home', '/board', '/profile'] },
  { path: '/friends', icon: '/icons/nav/friends.svg', label: '친구', owns: ['/friends', '/relay'] },
  { path: '/winery', icon: '/icons/nav/winery.svg', label: '와이너리', owns: ['/winery'] },
  { path: '/more', icon: '/icons/nav/more.svg', label: '더보기', badge: 'unread', owns: ['/more', '/messages', '/stats', '/vine', '/rewards', '/settings', '/notifications', '/sound-test'] },
];

export default function Navigation() {
  const pathname = usePathname();
  const unreadCount = useAppStore((s) => s.unreadCount);

  // 세그먼트 경계를 지키며(p===pre || p.startsWith(pre+'/')) owns 중 최장 prefix를 가진 탭을 활성화.
  // /winery 가 /winery-x 류를 오매칭하지 않고, 어디에도 안 걸리면 무탭(null)으로 안전 폴백.
  const activePath = useMemo(() => {
    const segMatch = (p: string, pre: string) => p === pre || p.startsWith(pre + '/');
    let best: { path: string; len: number } | null = null;
    for (const item of navItems) {
      for (const pre of item.owns) {
        if (segMatch(pathname, pre) && (!best || pre.length > best.len)) {
          best = { path: item.path, len: pre.length };
        }
      }
    }
    return best?.path ?? null;
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none bottom-nav">
      <div className="max-w-lg mx-auto px-3 pb-2">
        <div
          className="pointer-events-auto clay-puffy bg-white/95 backdrop-blur-md flex items-center justify-around py-2 px-1"
          style={{ borderRadius: '28px' }}
        >
          {navItems.map((item) => {
            const isActive = item.path === activePath;
            return (
              // <Link>: 하단 네비는 항상 뷰포트에 있어 4개 탭 라우트가 자동 프리페치된다
              // (button+router.push는 프리페치 0 — 탭 시점에야 RSC/청크 페치가 시작됐음).
              <Link
                key={item.path}
                href={item.path}
                onClick={feedbackTap}
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
                <span className="relative block">
                  <img
                    src={item.icon}
                    alt=""
                    width={24}
                    height={24}
                    draggable={false}
                    aria-hidden="true"
                    className={`block transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-45'}`}
                  />
                  {item.badge === 'unread' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-grape-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-[1.5px] border-warm-text">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className={`text-[10.5px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
