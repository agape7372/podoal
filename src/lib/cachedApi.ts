'use client';

// stale-while-revalidate 페이지 데이터 캐시.
//
// 문제: 전 페이지가 'use client' + fetch-on-mount + 로컬 useState라 라우트 전환
// (언마운트)마다 데이터가 증발 → 재방문에도 항상 '빈 상태 → 스켈레톤 → API 왕복'
// (웜 0.2~0.5s, 콜드 2s+)을 다시 지불했다. 이 모듈 레벨 Map은 라우트 전환에도
// 살아남는 세션 메모리로, 캐시가 있으면 즉시 렌더하고 백그라운드에서 조용히
// 재검증한다. 스켈레톤은 '캐시가 비어 있는 진짜 첫 방문'에만 보인다.
//
// 의도적으로 localStorage persist 하지 않음 — 세션 간 신선도/프라이버시 단순화.
// (PWA 재시작 첫 화면은 어차피 콜드 API 1회가 필요하다.)
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { createLatestGuard } from '@/lib/latestGuard';

const cache = new Map<string, unknown>();

// 키 스코프 구독자 — write-through(예: 보드 상세의 syncBoardCaches)가 마운트된
// 구독자(홈)를 즉시 리렌더시키는 채널. notify는 writeCachedApi에만 배선한다 —
// refresh/mutate는 자기 인스턴스를 직접 setData하므로 notify가 불필요하고,
// fetch→notify를 거기에도 걸면 되먹임(자기 자신을 재알림) 구조가 생긴다.
const listeners = new Map<string, Set<() => void>>();

/** url 키의 캐시 변경을 구독 — writeCachedApi가 그 키에 쓸 때마다 fn이 호출된다.
 *  반환값은 구독 해제 함수(빈 Set은 정리해 Map이 무한히 자라지 않게 한다). */
export function subscribeCachedApi(url: string, fn: () => void): () => void {
  let set = listeners.get(url);
  if (!set) {
    set = new Set();
    listeners.set(url, set);
  }
  set.add(fn);
  return () => {
    const cur = listeners.get(url);
    if (!cur) return;
    cur.delete(fn);
    if (cur.size === 0) listeners.delete(url);
  };
}

// 키별 write-through 버전 카운터 — refresh(fetch)가 진행 중일 때 writeCachedApi가 같은
// 키에 끼어들면, fetch 쪽이 서버 DB를 더 먼저 읽었어도(콜드 쿼리 등) 응답 도착은 write-
// through보다 늦을 수 있다. 그대로 반영하면 최신 상태를 스테일 스냅샷이 덮어써 카운트가
// 역행한다 — mergeServerBoard의 단조 철학(boardFillState.ts)을 리스트 캐시로 확장한 것.
const writeVersions = new Map<string, number>();

/** refresh 시작 시점의 write 버전을 캡처 — 응답 도착 시 isWriteVersionCurrent로 그 사이
 *  write-through가 끼어들었는지 판정한다. */
export function captureWriteVersion(url: string): number {
  return writeVersions.get(url) ?? 0;
}

/** captureWriteVersion으로 받은 버전이 아직 최신인지 — 다르면 그 사이 writeCachedApi가
 *  같은 키에 개입했다는 뜻이라, 지금 도착한 fetch 응답은 스테일이므로 버려야 한다. */
export function isWriteVersionCurrent(url: string, v: number): boolean {
  return (writeVersions.get(url) ?? 0) === v;
}

// 백그라운드 복귀(visibilitychange/focus) 재검증의 최소 간격 — mount 직후 재검증과의
// 중복 호출, 그리고 visibilitychange와 focus가 연달아 발화하는 이중 발사를 막는다.
const FOCUS_REVALIDATE_THROTTLE_MS = 5000;

/** 로그인(사용자 전환) 시 호출 — 이전 계정의 데이터가 새 계정 화면에 비치는 것 방지. */
export function clearPageCache() {
  cache.clear();
}

/** 특정 키만 무효화 (다음 mount에서 스켈레톤부터 시작하게 하고 싶을 때). */
export function invalidateCachedApi(url: string) {
  cache.delete(url);
}

/** 접두 일치 키 일괄 무효화 — 파라미터화된 상세 캐시 일족(예: '/api/relays')을
 *  키를 모르는 채로 비울 때. 다음 진입은 캐시 없이 서버 기준으로 시작한다. */
export function invalidateCachedApiPrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** 훅 밖에서 캐시 스냅샷 읽기 — 다른 페이지가 받아둔 응답으로 선렌더할 때 사용
 *  (예: board/[id]가 홈의 /api/boards 캐시에서 보드 요약을 꺼내 제목을 즉시 표시). */
export function readCachedApi<T>(url: string): T | undefined {
  return cache.get(url) as T | undefined;
}

/** 훅 밖에서 캐시 적재 — 프리페치(홈이 상위 보드 상세를 미리 받아둠)나
 *  페이지 로컬 상태의 스냅샷 동기화(보드 상세의 마지막 상태 보존)용. */
export function writeCachedApi<T>(url: string, value: T) {
  cache.set(url, value);
  // 통지보다 먼저 버전을 올린다 — refresh가 이 시점 이후 도착하는 응답을 스테일로
  // 판정하려면, 리스너 콜백(동기 realtime UI 갱신)이 도는 동안에도 이미 최신이어야 한다.
  writeVersions.set(url, (writeVersions.get(url) ?? 0) + 1);
  // 구독자에게 통지 — 반복 중 추가/해제가 섞여도 안전하도록 스냅샷(복사본)을 순회한다.
  const set = listeners.get(url);
  if (set) for (const fn of [...set]) fn();
}

export function useCachedApi<T>(url: string) {
  const [data, setData] = useState<T | undefined>(() => cache.get(url) as T | undefined);
  const [error, setError] = useState(false);
  // 실패가 HTTP 응답이었을 때의 상태 코드 — 네트워크 단절(fetch TypeError)은 undefined.
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
  // fetched: 이번 mount의 재검증이 완료됐는가 (성공/실패 불문)
  const [fetched, setFetched] = useState(false);

  // 마지막 재검증 발사 시각 — 복귀 재검증 스로틀의 기준점 (mount/수동 refresh 포함).
  const lastRefreshAtRef = useRef(0);

  // 역순 응답 가드 — url 전환(friends/[id]·relay/[id])이나 복귀 재검증이 겹칠 때,
  // 늦게 도착한 이전 요청이 새 화면 state를 덮어쓰지 않게 한다. 인스턴스당 하나 유지.
  const guardRef = useRef(createLatestGuard());

  const refresh = useCallback(async () => {
    const token = guardRef.current.begin();
    // M2 회귀 고정 — fetch가 도는 동안 write-through(예: 드레인 reconcile→syncBoardCaches)가
    // 같은 키에 끼어들면 그 응답은 스테일이다(mergeServerBoard의 단조 철학을 리스트 캐시로
    // 확장). guardRef(createLatestGuard)는 '같은 훅 인스턴스의 fetch끼리' 순서를 지키는
    // 가드이고, 이 버전 체크는 '이 fetch vs 다른 쓰기 경로(write-through)' 사이의 단조성을
    // 지킨다 — 서로 겹치지 않는 별개의 문제라 둘 다 유지한다.
    const writeVersion = captureWriteVersion(url);
    lastRefreshAtRef.current = Date.now();
    setError(false);
    setErrorStatus(undefined);
    try {
      const fresh = await api<T>(url);
      // write 버전이 그대로일 때만 캐시를 갱신 — 다르면 그 사이 write-through가 이미
      // 더 최신 상태를 반영했으므로, 늦게 도착한 이 스냅샷은 캐시도 화면도 건드리지
      // 않고 버린다(fetch 자체는 성공이라 loading/error 상태는 정상 종료시킨다).
      if (isWriteVersionCurrent(url, writeVersion)) {
        cache.set(url, fresh);
        if (guardRef.current.isLatest(token)) setData(fresh);
      }
    } catch (e) {
      if (!guardRef.current.isLatest(token)) return;
      setError(true);
      setErrorStatus(e instanceof ApiError ? e.status : undefined);
    } finally {
      if (guardRef.current.isLatest(token)) setFetched(true);
    }
  }, [url]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 다른 인스턴스의 write-through(예: syncBoardCaches)를 실시간 반영 — 동일 참조
  // 쓰기는 setData가 알아서 bail-out하므로 새 참조일 때만 리렌더된다.
  useEffect(() => subscribeCachedApi(url, () => setData(cache.get(url) as T | undefined)), [url]);

  // 백그라운드 복귀 재검증 — PWA/탭이 visible로 돌아오면 조용히 다시 받아온다.
  // 라우트 전환 없이 오래 떠 있던 화면(예: relay 상세)이 스테일로 고착되는 것 방지.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // 오프라인 복귀(라디오 재연결 전)엔 sw.js가 /api/*를 즉시 503으로 응답하므로
      // 확정 실패할 재검증을 건너뛴다 — 연결이 돌아오면 'online' 이벤트가 따라잡는다.
      if (navigator.onLine === false) return;
      if (Date.now() - lastRefreshAtRef.current < FOCUS_REVALIDATE_THROTTLE_MS) return;
      refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [refresh]);

  // 낙관적/로컬 갱신용 — 캐시와 화면을 함께 갱신해 다음 방문에도 일관되게 보인다.
  // updater가 undefined를 반환하면 no-op (아직 데이터가 없는 상태에서의 갱신 시도 가드).
  const mutate = useCallback(
    (updater: T | ((prev: T | undefined) => T | undefined)) => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: T | undefined) => T | undefined)(cache.get(url) as T | undefined)
          : updater;
      if (next === undefined) return;
      cache.set(url, next);
      setData(next);
    },
    [url],
  );

  return {
    data,
    /** 스켈레톤 게이트: 캐시도 없고 아직 응답도 없을 때만 true */
    loading: data === undefined && !fetched,
    /** 에러 화면 게이트: 보여줄 데이터가 전혀 없을 때만 — 무음 재검증 실패는 기존 화면 유지 */
    error: error && data === undefined,
    /** 무음 재검증 실패 포함 원시 에러 — 캐시가 있어도 실패 자체에 반응해야 할 때. */
    refreshFailed: error,
    /** 실패가 HTTP 응답일 때의 상태 코드(네트워크 단절은 undefined, 오프라인 SW는 503).
     *  '접근 상실'(403 권한 없음/404 삭제)만 골라 반응해야 할 때 이쪽을 본다
     *  (예: relay 상세의 목록 복귀 — 일시 장애에 스테일 화면을 버리면 안 된다). */
    refreshFailedStatus: errorStatus,
    /** 이번 mount의 재검증이 완료됐는가 — '서버 기준 확정값'이 필요한 분기(온보딩 등)용. */
    validated: fetched,
    refresh,
    mutate,
  };
}
