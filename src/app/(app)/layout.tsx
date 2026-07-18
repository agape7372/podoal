'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import MessagePopup from '@/components/MessagePopup';
import InstallPrompt from '@/components/InstallPrompt';
import AnalyticsConsentBanner from '@/components/AnalyticsConsentBanner';
import UnreadSync from '@/components/UnreadSync';
import OfflineBanner from '@/components/OfflineBanner';
import { useAppStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { useReminderScheduler } from '@/lib/useReminderScheduler';
import { FETCH_USER_TRANSIENT, fetchUser } from '@/lib/api';
import { clearPageCache, setPageCacheOwner } from '@/lib/cachedApi';
import { consentUnset, consumeOAuthPending, identifyUser, seedConsentFromServer } from '@/lib/analytics';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  // 동의 미응답 동안 InstallPrompt 슬롯을 동의 배너가 차지한다(상호 배타 — 하단 배너
  // 두 장이 겹치면 z-30 한 층에서 서로를 가린다). localStorage 판정이라 effect에서 세팅.
  const [consentPending, setConsentPending] = useState(false);

  useEffect(() => {
    setConsentPending(consentUnset());
  }, []);

  // 인증 확인은 자식 렌더와 병렬로 진행한다. 예전처럼 user 로딩 완료까지 자식을
  // 막으면 "렌더 → auth/me → DB → 자식 fetch 시작"의 3홉 직렬 워터폴이 생긴다.
  // 자식 페이지는 user 없이도 첫 렌더가 안전하고(옵셔널 접근 + 페이지별 폴백),
  // 미인증 사용자는 fetchUser 실패 시 기존과 동일하게 / 로 리다이렉트한다
  // (그 전까지 잠깐 보이는 빈 셸은 수용 — API가 어차피 401로 데이터를 막는다).
  useEffect(() => {
    fetchUser().then((u) => {
      // 판정 불가(오프라인·5xx·SW 503) — 세션이 죽었다는 증거가 아니다. 스냅샷·캐시를
      // 유지한 채 그대로 둔다(오프라인 배너가 UX를 담당, 복귀 시 재검증이 따라잡음).
      // null(확정 401/404)과 구분하지 않으면 비행기 모드에서 로그아웃+캐시 전소가 난다.
      if (u === FETCH_USER_TRANSIENT) return;
      if (!u) {
        // 세션 무효 — 영속 스냅샷(user·페이지 캐시)을 비우고 웰컴으로. 비우지 않으면
        // '/'의 스냅샷 낙관 리다이렉트와 여기가 서로를 무한 왕복시킨다.
        useAppStore.getState().setUser(null);
        clearPageCache();
        router.replace('/');
        return;
      }
      // 영속 페이지 캐시의 소유자 대조 — 다른 계정 스냅샷이면 여기서 전량 폐기된다.
      setPageCacheOwner(u.id);
      // 내용이 같으면 setUser 생략 — 무조건 새 객체로 갈아끼우면 user를 deps로 둔
      // effect들(SSE 연결, 리마인더 페치)이 참조 변경만으로 전부 teardown+재실행되어
      // 웰컴→홈 진입 시 SSE 이중 연결 + reminders/settings 중복 페치가 발생했다.
      const cur = useAppStore.getState().user;
      if (
        !cur ||
        cur.id !== u.id ||
        cur.name !== u.name ||
        cur.email !== u.email ||
        cur.avatar !== u.avatar ||
        // 스냅샷 시드(store.ts) 도입 후 cur가 구 세션 값일 수 있다 — auth/me만 내려주는
        // 부가 필드(경계 시각·동의 등)도 대조해 스냅샷이 서버값으로 따라오게 한다.
        cur.provider !== u.provider ||
        cur.analyticsConsentAt !== u.analyticsConsentAt ||
        cur.createdAt !== u.createdAt ||
        cur.dayResetHour !== u.dayResetHour
      ) {
        setUser(u);
      }
      // 계측(ANALYTICS_PLAN §4·§5) — 다른 기기에서 이미 동의했으면 배너 생략,
      // 식별은 내부 cuid만. 둘 다 동의 게이트 뒤에서 no-op 가능한 안전 호출.
      seedConsentFromServer(u.analyticsConsentAt);
      setConsentPending(consentUnset());
      identifyUser(u.id);
      // OAuth 복귀(전체 리다이렉트) 시 웰컴에서 남긴 method 플래그를 여기서 1회 소비.
      consumeOAuthPending(u);
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
      <OfflineBanner />
      <UnreadSync />
      <MessagePopup />
      <main className="max-w-lg mx-auto px-4 pt-4 safe-top">
        {children}
      </main>
      {consentPending ? (
        <AnalyticsConsentBanner avoidFab onDecided={() => setConsentPending(false)} />
      ) : (
        <InstallPrompt avoidFab />
      )}
      <Navigation />
    </div>
  );
}
