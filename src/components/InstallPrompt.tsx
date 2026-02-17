'use client';

import { useState, useEffect } from 'react';

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
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if dismissed within last 7 days
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
    <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4 pb-2 safe-bottom animate-slide-up">
      <div className="max-w-lg mx-auto clay p-4 bg-gradient-to-r from-grape-500 to-grape-600 text-white">
        <div className="flex items-center gap-3">
          <span className="text-3xl flex-shrink-0">🍇</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">포도알을 홈 화면에 추가하세요!</p>
            <p className="text-xs text-white/80 mt-0.5">더 빠르고 편리하게 사용할 수 있어요</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="text-xs text-white/70 hover:text-white px-2 py-1.5"
            >
              닫기
            </button>
            <button
              onClick={handleInstall}
              className="clay-button bg-white text-grape-600 px-4 py-1.5 rounded-xl text-sm font-bold"
            >
              설치
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
