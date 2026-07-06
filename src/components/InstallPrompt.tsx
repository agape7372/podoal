'use client';

import { useState, useEffect } from 'react';
import Podo from './mascot/Podo';
import EmojiIcon from './EmojiIcon';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'podoal-install-dismissed';
const DISMISS_DAYS = 7;

interface InstallPromptProps {
  /** 우측 하단 FAB(홈 +버튼)이 있는 화면에서만 true — 배너가 FAB 폭만큼 오른쪽을
   *  비킨다. FAB 없는 화면(웰컴)에서 이 여백을 주면 배너가 왼쪽으로 쏠려 보인다. */
  avoidFab?: boolean;
}

export default function InstallPrompt({ avoidFab = false }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // 'prompt' = Chrome/Android 네이티브 설치 가능, 'ios' = iOS Safari 수동 안내, null = 숨김.
  const [mode, setMode] = useState<'prompt' | 'ios' | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return; // 이미 설치됨

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime();
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // iOS Safari는 beforeinstallprompt를 발생시키지 않는다 → 수동 안내(공유 → 홈 화면에 추가)를
    // 따로 띄워야 iOS 사용자가 설치 경로를 알 수 있다(설치해야 웹푸시도 받을 수 있음).
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) {
      setMode('ios');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setMode(null);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setMode(null);
    setDeferredPrompt(null);
  };

  if (!mode) return null;

  // 우측 하단 FAB(홈, bottom-28 right-6)와 겹쳐 버튼이 가려지던 문제 →
  // FAB 있는 화면(avoidFab)에서만 오른쪽에 FAB 폭만큼 여백을 둬 코너를 비킨다.
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
            {/* prompt(안드로이드) 분기는 X+설치 버튼이 폭을 먹어 360dp에서 제목 가용폭이
                ~84px — MaruBuri 600 실측 88px(14px)는 줄바꿈, 81.7px(13px)만 한 줄. */}
            <p className={`font-display ${mode === 'prompt' ? 'text-[13px]' : 'text-[14px]'} font-semibold text-warm-text leading-snug`}>
              홈 화면에 추가
            </p>
            {mode === 'ios' && (
              <p className="text-[11px] text-warm-sub leading-snug mt-0.5">
                공유 <EmojiIcon emoji="📤" size={12} className="inline align-[-1px]" /> → 홈 화면에 추가
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mode === 'ios' ? (
              <button
                onClick={handleDismiss}
                className="text-xs text-warm-sub hover:text-warm-text px-3 py-1.5 rounded-xl"
              >
                확인
              </button>
            ) : (
              <>
                <button
                  onClick={handleDismiss}
                  aria-label="닫기"
                  className="w-8 h-8 rounded-full grid place-items-center text-warm-sub hover:text-warm-text active:scale-95 transition-transform"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
                <button
                  onClick={handleInstall}
                  className="clay-button bg-linear-to-br from-grape-500 to-lime-300 text-white px-3 py-2 rounded-2xl text-sm font-semibold border-transparent"
                >
                  설치
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
