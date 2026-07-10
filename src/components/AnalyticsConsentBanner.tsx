'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Podo from './mascot/Podo';
import { consentUnset, setConsent } from '@/lib/analytics';
import { api } from '@/lib/api';
import { feedbackTap } from '@/lib/feedback';

// 익명 사용 통계 동의 배너(ANALYTICS_PLAN §4 — 문구 확정본). InstallPrompt와 같은
// 슬롯(fixed bottom-[88px] z-30)을 쓰며 (app)/layout이 상호 배타로 렌더한다.
// 거절·미응답 = 수집 0. 결정은 설정 → 개인정보 토글에서 언제든 바꿀 수 있다.
interface AnalyticsConsentBannerProps {
  /** InstallPrompt와 동일 — FAB 있는 화면에서 오른쪽을 비킨다. */
  avoidFab?: boolean;
  /** 응답(수락/거절) 직후 호출 — layout이 InstallPrompt로 슬롯을 되돌리는 신호. */
  onDecided?: () => void;
}

export default function AnalyticsConsentBanner({ avoidFab = false, onDecided }: AnalyticsConsentBannerProps) {
  // consentUnset은 localStorage 접근이라 SSR/hydration 불일치 방지를 위해 effect에서 판정.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(consentUnset());
  }, []);

  if (!visible) return null;

  const decide = (granted: boolean) => {
    feedbackTap();
    setConsent(granted);
    // 서버 동기화는 fire-and-forget — 실패해도 로컬 결정이 유효(다음 기기에서 다시 물을 뿐).
    api('/api/auth/consent', { method: 'PATCH', json: { granted } }).catch(() => {});
    setVisible(false);
    onDecided?.();
  };

  return (
    <div className={`fixed bottom-[88px] left-0 right-0 z-30 pl-4 ${avoidFab ? 'pr-[88px]' : 'pr-4'} safe-bottom animate-slide-up pointer-events-none`}>
      <div className="max-w-md mx-auto pointer-events-auto">
        <div
          className="clay-puffy bg-white/95 backdrop-blur-md flex items-center gap-2 p-2.5 pr-3"
          style={{ borderRadius: '28px' }}
        >
          <div className="shrink-0 bg-grape-50 rounded-full p-1" style={{ borderRadius: '999px' }}>
            <Podo size={36} decorative />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-[13px] font-semibold text-warm-text leading-snug">
              서비스 개선을 위해 익명 사용 통계를 수집해요
            </p>
            <Link
              href="/settings/privacy"
              onClick={feedbackTap}
              className="text-[11px] text-warm-sub underline underline-offset-2 leading-snug mt-0.5 inline-block"
            >
              개인정보처리방침
            </Link>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => decide(false)}
              className="clay-button px-3 py-2 rounded-2xl text-sm font-semibold text-warm-sub"
            >
              안 할래요
            </button>
            <button
              onClick={() => decide(true)}
              className="clay-button bg-linear-to-br from-grape-500 to-lime-300 text-white px-3 py-2 rounded-2xl text-sm font-semibold border-transparent"
            >
              좋아요
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
