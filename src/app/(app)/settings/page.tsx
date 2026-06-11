'use client';

import Link from 'next/link';
import { feedbackTap } from '@/lib/feedback';
import EmojiIcon from '@/components/EmojiIcon';

// 설정 허브 — 컨트롤은 하위 페이지가 갖는다. 사운드·진동 토글은 /settings/sound,
// 알림 관련 컨트롤은 전부 알림 설정 탭으로 통합(REQ7).
const settingLinks = [
  { path: '/settings/sound', icon: '🔊', label: '소리 및 진동', desc: '효과음·진동·포도알 소리' },
  { path: '/notifications', icon: '🔔', label: '알림', desc: '팝업·방해금지·리마인더 설정' },
];

export default function SettingsPage() {
  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">설정</h1>

      <section className="clay overflow-hidden mb-4">
        {settingLinks.map((item, i) => (
          // <Link>: 행이 뷰포트에 들어오는 순간 하위 설정 라우트가 프리페치됨
          <Link
            key={item.path}
            href={item.path}
            onClick={feedbackTap}
            className={`w-full flex items-center gap-3 p-4 text-left transition-transform active:scale-[0.98] ${
              i > 0 ? 'border-t border-warm-border/55' : ''
            }`}
          >
            <EmojiIcon emoji={item.icon} size={20} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-warm-text">{item.label}</span>
              <span className="block text-xs text-warm-sub mt-0.5 truncate">{item.desc}</span>
            </span>
            <span className="text-warm-sub text-sm" aria-hidden="true">{'>'}</span>
          </Link>
        ))}
      </section>

      {/* App info */}
      <section className="clay p-5">
        <h2 className="text-sm font-semibold text-warm-sub mb-3">앱 정보</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-warm-text">버전</span>
            <span className="text-sm text-warm-sub tabular-nums">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-warm-text">포도알</span>
            <span className="text-sm text-warm-sub inline-flex items-center gap-1"><EmojiIcon emoji="🍇" size={14} /> Podoal</span>
          </div>
        </div>
      </section>
    </div>
  );
}
