'use client';

import { useEffect, useState } from 'react';

/**
 * 오프라인 상태 배너 — GAP-07 (PERSONA_REVIEW). 오프라인에서 알 채우기가 조용히
 * 실패해도 안내가 없어 사용자가 앱 버그로 오인하는 문제(P01 "앱 탓인 줄")에 대한
 * "상태 고지"만 하는 최소 대응. 오프라인 채우기 자체(백로그, 위험 高)는 범위 밖.
 *
 * SSR/hydration 안전: 서버 렌더와 클라이언트 첫 렌더 모두 "온라인"으로 가정한다
 * (초기 state = true → 배너 숨김, 서버 출력과 동일). 마운트 후 useEffect가
 * navigator.onLine으로 실제 상태를 재확정하므로, 실제로 오프라인이었다면 하이드레이션
 * 직후 한 틱 안에 배너가 나타난다 — 이 갱신은 커밋 이후 발생해 하이드레이션
 * mismatch를 만들지 않는다.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 온라인 복귀 시 간단 제거 — 복귀 축하 토스트 등은 범위 밖(스펙 제약).
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] pt-[env(safe-area-inset-top)] bg-clay-lavender border-b border-warm-border/60 shadow-clay-sm animate-fade-in"
    >
      <div className="max-w-lg mx-auto flex items-center justify-center gap-1.5 py-2 px-4">
        {/*
          스펙은 EmojiIcon 📡/☁ 를 지정했으나, 두 이모지 모두 public/icons/fluent/에
          대응 SVG가 없어(1f4e1.svg, 2601.svg 부재) EmojiIcon 경유 시 check-icons.mjs가
          npm run lint를 실패시킨다. 아이콘 자산 추가는 이 카드의 소유 파일 밖이라
          여기서 새로 만들 수 없으므로, InstallPrompt.tsx의 닫기 아이콘과 동일한
          관례(인라인 stroke SVG)로 "신호 없음"을 대체 표현한다.
        */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-warm-text"
        >
          <rect x="2" y="13" width="4" height="8" rx="1" />
          <rect x="10" y="8" width="4" height="13" rx="1" />
          <rect x="18" y="3" width="4" height="18" rx="1" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
        <p className="text-sm font-medium text-warm-text text-center">
          지금은 오프라인이에요 · 연결되면 다시 채울 수 있어요
        </p>
      </div>
    </div>
  );
}
