'use client';

import { useState, useEffect } from 'react';
import Podo from './mascot/Podo';
import EmojiIcon from './EmojiIcon';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';

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
  // iOS "방법 보기" 탭 → 단계 안내 시트 오픈 여부. 시트를 닫아도 배너 자체는 유지되고
  // (스누즈는 X만), requestClose는 이탈 애니 종료 후 이 state를 꺼 언마운트한다.
  const [showGuide, setShowGuide] = useState(false);
  const { closeRef, requestClose } = useModalClose(() => setShowGuide(false));

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
    <>
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
              {/* 두 분기 모두 이제 X+주 액션 버튼 2개 구성(구 iOS는 "확인" 단독 버튼이라
                  더 넓었지만, "방법 보기"로 길어지고 X까지 붙어 prompt와 같은 폭 제약을
                  받는다) — prompt 전용이던 13px(MaruBuri 600 81.7px 실측 fit)을 양쪽에 적용. */}
              <p className="font-display text-[13px] font-semibold text-warm-text leading-snug">
                홈 화면에 추가
              </p>
              {mode === 'ios' && (
                <p className="text-[11px] text-warm-sub leading-snug mt-0.5">
                  설치하면 알림도 받고 홈에서 바로 열어요
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleDismiss}
                aria-label="닫기"
                className="w-8 h-8 rounded-full grid place-items-center text-warm-sub hover:text-warm-text active:scale-95 transition-transform"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
              {mode === 'ios' ? (
                <button
                  onClick={() => setShowGuide(true)}
                  className="clay-button bg-linear-to-br from-grape-500 to-lime-300 text-white px-3 py-2 rounded-2xl text-sm font-semibold border-transparent"
                >
                  방법 보기
                </button>
              ) : (
                <button
                  onClick={handleInstall}
                  className="clay-button bg-linear-to-br from-grape-500 to-lime-300 text-white px-3 py-2 rounded-2xl text-sm font-semibold border-transparent"
                >
                  설치
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* iOS "방법 보기" 단계 안내 시트 — 공용 Modal sheet variant(기본값, ReminderModal/
          CapsuleModal과 동일 프리셋). 시트를 닫아도 배너(mode)는 안 바뀐다 — 스누즈는
          배너의 X(handleDismiss)만 담당, 이 시트는 정보 제공 후 requestClose로만 닫힌다. */}
      {showGuide && (
        <Modal
          onClose={() => setShowGuide(false)}
          closeRef={closeRef}
          label="홈 화면에 추가하는 방법"
          backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
        >
          <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />
          <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-5">
            홈 화면에 추가하는 방법
          </h3>
          <ol className="space-y-3 mb-5 text-left">
            <li className="flex items-center gap-3">
              <span className="shrink-0 w-9 h-9 rounded-full clay-sm grid place-items-center">
                <EmojiIcon emoji="📤" size={20} />
              </span>
              <p className="text-sm text-warm-text leading-snug">
                <span className="text-grape-600 tabular-nums mr-1">1</span>
                Safari 하단의 공유 버튼을 눌러요
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="shrink-0 w-9 h-9 rounded-full clay-sm grid place-items-center">
                <span className="text-grape-700 text-xl font-bold leading-none" aria-hidden="true">+</span>
              </span>
              <p className="text-sm text-warm-text leading-snug">
                <span className="text-grape-600 tabular-nums mr-1">2</span>
                &apos;홈 화면에 추가&apos;를 찾아 눌러요
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="shrink-0 w-9 h-9 rounded-full clay-sm grid place-items-center">
                <EmojiIcon emoji="✅" size={20} />
              </span>
              <p className="text-sm text-warm-text leading-snug">
                <span className="text-grape-600 tabular-nums mr-1">3</span>
                오른쪽 위 &apos;추가&apos;를 누르면 끝!
              </p>
            </li>
          </ol>
          <p className="text-xs text-warm-sub text-center mb-5">
            설치하면 앱처럼 열리고, 알림도 받을 수 있어요
          </p>
          <ClayButton variant="ghost" onClick={requestClose} fullWidth>
            확인
          </ClayButton>
        </Modal>
      )}
    </>
  );
}
