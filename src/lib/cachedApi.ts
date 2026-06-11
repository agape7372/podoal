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
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const cache = new Map<string, unknown>();

/** 로그인(사용자 전환) 시 호출 — 이전 계정의 데이터가 새 계정 화면에 비치는 것 방지. */
export function clearPageCache() {
  cache.clear();
}

/** 특정 키만 무효화 (다음 mount에서 스켈레톤부터 시작하게 하고 싶을 때). */
export function invalidateCachedApi(url: string) {
  cache.delete(url);
}

export function useCachedApi<T>(url: string) {
  const [data, setData] = useState<T | undefined>(() => cache.get(url) as T | undefined);
  const [error, setError] = useState(false);
  // fetched: 이번 mount의 재검증이 완료됐는가 (성공/실패 불문)
  const [fetched, setFetched] = useState(false);

  const refresh = useCallback(async () => {
    setError(false);
    try {
      const fresh = await api<T>(url);
      cache.set(url, fresh);
      setData(fresh);
    } catch {
      setError(true);
    } finally {
      setFetched(true);
    }
  }, [url]);

  useEffect(() => {
    refresh();
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
    refresh,
    mutate,
  };
}
