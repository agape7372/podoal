'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { feedbackTap } from '@/lib/feedback';
import EmojiIcon from '@/components/EmojiIcon';

type MoreItem = { path: string; icon: string; label: string; desc?: string; badge?: 'unread' };
type MoreSection = { title: string; chip: string; items: MoreItem[] };

const sections: MoreSection[] = [
  {
    title: '소통',
    chip: 'bg-grape-100',
    items: [
      // 배지는 '알림함'에만 — store.unreadCount는 통합 알림 피드(/api/notifications)의
      // 미읽음 수라 정직한 목적지가 인박스다('소통'=메시지함에 달면 숫자와 내용물이 어긋남).
      { path: '/notifications/inbox', icon: '🔔', label: '알림함', desc: '응원·보상·초대 알림 모아보기', badge: 'unread' },
      { path: '/messages', icon: '💌', label: '소통', desc: '응원·축하·선물 메시지' },
    ],
  },
  {
    title: '나의 기록',
    chip: 'bg-leaf-100',
    items: [
      { path: '/rewards', icon: '🍇', label: '포도밭', desc: '받은 보상·중간보상' },
      { path: '/stats', icon: '📊', label: '통계', desc: '달성률·히트맵' },
      { path: '/vine', icon: '🌿', label: '포도덩굴', desc: '활동 타임라인' },
    ],
  },
  {
    title: '설정',
    chip: 'bg-sunshine-100',
    items: [
      { path: '/notifications', icon: '🔔', label: '알림 설정' },
      { path: '/sound-test', icon: '🔊', label: '포도알 소리' },
      { path: '/settings', icon: '⚙️', label: '설정' },
    ],
  },
];

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-warm-sub shrink-0"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function MorePage() {
  const router = useRouter();
  const unreadCount = useAppStore((s) => s.unreadCount);

  const go = (path: string) => {
    feedbackTap();
    router.push(path);
  };

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">더보기</h1>

      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="animate-fade-in">
            <h2 className="text-sm font-semibold text-warm-sub mb-2 ml-1">{section.title}</h2>

            <div className="clay overflow-hidden">
              {section.items.map((item, i) => (
                <button
                  key={item.path}
                  onClick={() => go(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.98] ${
                    i > 0 ? 'border-t border-warm-border/55' : ''
                  }`}
                >
                  <span
                    className={`grid place-items-center w-11 h-11 rounded-[14px] shrink-0 ${section.chip}`}
                  >
                    <EmojiIcon emoji={item.icon} size={26} />
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-warm-text">{item.label}</span>
                    {item.desc && (
                      <span className="block text-xs text-warm-sub mt-0.5 truncate">{item.desc}</span>
                    )}
                  </span>

                  {item.badge === 'unread' && unreadCount > 0 && (
                    <span className="bg-grape-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center tabular-nums shrink-0">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}

                  <Chevron />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
