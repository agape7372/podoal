'use client';

import { useEffect } from 'react';
import { refreshUnreadCount } from '@/lib/notifications';

/**
 * 미읽음 배지 동기화 트리거의 단일 소유자 — (app) 레이아웃에 마운트되는 렌더-null 컴포넌트.
 * 어느 탭/페이지에 있든 라우트 전환·탭 복귀·창 포커스 시 store.unreadCount를
 * 서버 기준값으로 갱신한다(종·네비 '더보기' 탭·더보기 '알림함' 배지가 함께 따라온다).
 *
 * 원래 NotificationBell(홈에서만 마운트)이 들고 있던 로직을 전역으로 승격한 것 —
 * 홈 밖 탭에 머무는 동안 새 알림이 배지에 안 뜨던 문제를 해결한다.
 * 트리거는 반드시 여기 한 곳에만 둔다(다른 컴포넌트에 복제하면 이중 fetch).
 */
// 첫 동기화 지연 — 앱 실행 직후는 페이지 임계 fetch(/api/boards 등)가 콜드 서버리스/
// Neon 자원을 두고 경쟁하는 창이다. 배지는 즉시성이 필요 없으므로 폭주에서 뺀다.
const INITIAL_SYNC_DELAY_MS = 2500;

export default function UnreadSync() {
  // 첫 마운트 1회만(지연 발사) — 예전엔 라우트 전환마다 재조회했는데, 모든 페이지 이동에
  // 본 fetch와 무관한 5쿼리 집계 API가 1건씩 따라붙어 임계 경로와 경쟁했다.
  // 전환 중 배지 갱신은 이미 다른 경로가 책임진다: SSE 수신(addMessage 낙관 증가),
  // 인박스 진입(피드로 setUnreadCount), 메시지 읽음/삭제(force 동기화), 탭 복귀(아래).
  useEffect(() => {
    const t = setTimeout(() => refreshUnreadCount(), INITIAL_SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // 탭이 다시 보이거나 창에 포커스될 때 재조회 — 체류 중 도착한 응원·초대·보상을 즉시 반영.
  // visibilitychange와 focus가 동시에 발화해도 refreshUnreadCount 내부 1.5초 스로틀이
  // 중복 fetch를 걸러낸다.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUnreadCount(); };
    const onFocus = () => { refreshUnreadCount(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
