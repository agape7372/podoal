'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import MessagePopup from '@/components/MessagePopup';
import InstallPrompt from '@/components/InstallPrompt';
import { useAppStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { useReminderScheduler } from '@/lib/useReminderScheduler';
import { fetchUser } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);

  // 인증 확인은 자식 렌더와 병렬로 진행한다. 예전처럼 user 로딩 완료까지 자식을
  // 막으면 "렌더 → auth/me → DB → 자식 fetch 시작"의 3홉 직렬 워터폴이 생긴다.
  // 자식 페이지는 user 없이도 첫 렌더가 안전하고(옵셔널 접근 + 페이지별 폴백),
  // 미인증 사용자는 fetchUser 실패 시 기존과 동일하게 / 로 리다이렉트한다
  // (그 전까지 잠깐 보이는 빈 셸은 수용 — API가 어차피 401로 데이터를 막는다).
  useEffect(() => {
    fetchUser().then((u) => {
      if (!u) {
        router.replace('/');
      } else {
        setUser(u);
      }
    });
  }, [router, setUser]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useSSE();
  useReminderScheduler();

  return (
    <div className="min-h-dvh pb-[160px]">
      <MessagePopup />
      <main className="max-w-lg mx-auto px-4 pt-4 safe-top">
        {children}
      </main>
      <InstallPrompt />
      <Navigation />
    </div>
  );
}
