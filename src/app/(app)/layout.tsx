'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import MessagePopup from '@/components/MessagePopup';
import { useAppStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { fetchUser } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    fetchUser().then((u) => {
      if (!u) {
        router.replace('/');
      } else {
        setUser(u);
      }
    });
  }, [router, setUser]);

  useSSE();

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-float mb-4">🍇</div>
          <p className="text-warm-sub">로딩중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-20">
      <MessagePopup />
      <main className="max-w-lg mx-auto px-4 pt-4 safe-top">
        {children}
      </main>
      <Navigation />
    </div>
  );
}
