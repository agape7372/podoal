'use client';

import { useState, useEffect } from 'react';
import Podo from './mascot/Podo';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'podoal-install-dismissed';
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime();
      const now = Date.now();
      if (now - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-[88px] left-0 right-0 z-30 px-4 safe-bottom animate-slide-up pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div
          className="clay-puffy bg-white/95 backdrop-blur-md flex items-center gap-3 p-3 pr-4"
          style={{ borderRadius: '28px' }}
        >
          <div className="flex-shrink-0 bg-grape-50 rounded-full p-1.5" style={{ borderRadius: '999px' }}>
            <Podo size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-[14px] font-semibold text-warm-text leading-snug">
              홈 화면에 추가
            </p>
            <p className="text-[11px] text-warm-sub leading-snug mt-0.5">
              더 빠르고 편리하게 사용할 수 있어요
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="text-xs text-warm-sub hover:text-warm-text px-2 py-1.5 rounded-xl"
            >
              나중에
            </button>
            <button
              onClick={handleInstall}
              className="clay-button bg-gradient-to-br from-grape-500 to-lime-300 text-white px-4 py-2 rounded-2xl text-sm font-semibold border-transparent"
            >
              설치
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
