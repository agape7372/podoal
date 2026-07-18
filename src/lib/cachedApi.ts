'use client';

// stale-while-revalidate 페이지 데이터 캐시.
//
// 문제: 전 페이지가 'use client' + fetch-on-mount + 로컬 useState라 라우트 전환
// (언마운트)마다 데이터가 증발 → 재방문에도 항상 '빈 상태 → 스켈레톤 → API 왕복'
// (웜 0.2~0.5s, 콜드 2s+)을 다시 지불했다. 이 모듈 레벨 Map은 라우트 전환에도
// 살아남는 세션 메모리로, 캐시가 있으면 즉시 렌더하고 백그라운드에서 조용히
// 재검증한다. 스켈레톤은 '캐시가 비어 있는 진짜 첫 방문'에만 보인다.
//
// localStorage 영속(2026-07-18, 스켈레톤 감사): 세션 메모리만으로는 PWA 재실행/
// 탭 복귀마다 캐시가 증발해 "실행할 때마다 전 페이지 스켈레톤 + 콜드 API 왕복"이
// 보장됐다. 이제 캐시를 localStorage에 write-through 스냅샷으로 남기고 부팅 시
// 시드해, 재실행 첫 화면도 마지막 데이터로 즉시 페인트하고 무음 재검증한다.
// 구 주석의 "의도적으로 persist 하지 않음(신선도/프라이버시)" 결정은 이 감사에서
// 명시적으로 뒤집었다 — 신선도는 기존 재검증이 그대로 보장하고(영속 데이터는 항상
// 재검증 대상), 계정 전환은 소유자 검증(setPageCacheOwner) + clearPageCache로 막는다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { createLatestGuard } from '@/lib/latestGuard';

const cache = new Map<string, unknown>();

// 같은 키의 동시 재검증을 하나의 요청으로 합치는 in-flight 공유 — 홈↔통계처럼
// 같은 키('/api/stats')를 쓰는 화면 전환에서 미중단(no-abort) 직전 요청과 새 mount
// 재검증이 겹칠 때 중복 왕복을 없앤다.
const inflight = new Map<string, Promise<unknown>>();

// 키별 마지막 '성공' 수신 시각 — mount 재검증 TTL의 기준. 영속 시드 데이터는 여기
// 기록이 없으므로(구 세션) 항상 재검증된다.
const lastSuccessAt = new Map<string, number>();

// 백그라운드 복귀(visibilitychange/focus) 재검증의 최소 간격 — mount 직후 재검증과의
// 중복 호출, 그리고 visibilitychange와 focus가 연달아 발화하는 이중 발사를 막는다.
const FOCUS_REVALIDATE_THROTTLE_MS = 5000;

// mount 재검증 TTL — 같은 키가 이 시간 안에 성공 응답을 받았다면 mount 재검증을
// 건너뛴다(복귀 스로틀과 같은 5초 감각). 홈→통계→홈 같은 빠른 탭 왕복이 매번
// 전체 API를 재발사하던 것을 막는다. validated 소비자(온보딩 분기)에게도 ≤5초
// 이전의 서버 확정값은 확정값으로 취급된다.
const MOUNT_REVALIDATE_TTL_MS = 5000;

// ─── localStorage 영속 레이어 ─────────────────────────────────
// 스냅샷 봉투: { v, userId, entries }. userId는 계정 전환 감지용(setPageCacheOwner).
// 실패(quota/사파리 프라이빗)는 전부 조용히 무시 — 영속은 순수 최적화 레이어다.
const PERSIST_KEY = 'podoal-page-cache-v1';
const PERSIST_VERSION = 1;
const PERSIST_DEBOUNCE_MS = 800;
// localStorage 예산(문자 수 기준 ≈ bytes). 초과 시 상세 키(파라미터화 자식)부터 버린다.
const PERSIST_MAX_CHARS = 300_000;

let cacheOwnerId: string | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// 클리어 세대(epoch) — clearPageCache 이후 뒤늦게 도착한 미중단(no-abort) 응답이
// 방금 비운 캐시를 이전 계정 데이터로 재오염시키는 것을 막는다: fetch 시작 시점의
// epoch와 완료 시점의 epoch가 다르면 캐시/영속 쓰기를 버린다.
let cacheEpoch = 0;

// 하이드레이션 정합 게이트 — 서버 프리렌더 HTML은 캐시 없음(스켈레톤)으로 그려져
// 있으므로, 첫(하이드레이션) 렌더의 useState 초기값이 module-load 시드를 그대로 쓰면
// React가 전체 루트를 recoverable 에러와 함께 클라 재렌더한다. 첫 커밋의 effect부터
// true — 이후 SPA 마운트는 동기 캐시 읽기(즉시 페인트)를 그대로 쓴다.
let hydrated = false;

/** 파라미터화된 상세 캐시 키(/api/boards/<id> 등) — 예산 초과 시 1순위로 탈락. */
function isDetailKey(url: string): boolean {
  return /^\/api\/(boards|relays|friends)\/./.test(url);
}

function persistNow() {
  if (typeof window === 'undefined') return;
  // 소유자 미확정 상태에선 영속하지 않는다 — (1) 로그아웃 직후 pagehide 플러시가
  // 키를 되살리는 것, (2) userId:null '무소유 봉투'가 생겨 다음 계정이 이전 계정
  // 데이터를 입양하는 것 둘 다 여기서 차단된다. 부팅 직후 소유자 확정 전에 받은
  // 데이터는 setPageCacheOwner의 schedulePersist가 곧바로 따라잡는다.
  if (cacheOwnerId === null) return;
  try {
    const entries: Record<string, unknown> = {};
    for (const [k, v] of cache) entries[k] = v;
    let payload = JSON.stringify({ v: PERSIST_VERSION, userId: cacheOwnerId, entries });
    if (payload.length > PERSIST_MAX_CHARS) {
      for (const k of Object.keys(entries)) {
        if (isDetailKey(k)) delete entries[k];
      }
      payload = JSON.stringify({ v: PERSIST_VERSION, userId: cacheOwnerId, entries });
      if (payload.length > PERSIST_MAX_CHARS) return; // 목록 키만으로도 초과 — 이번 스냅샷 포기
    }
    localStorage.setItem(PERSIST_KEY, payload);
  } catch {
    // quota 초과/localStorage 불가 — 영속 없이 세션 메모리로만 동작
  }
}

function schedulePersist() {
  if (typeof window === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
}

/** cache.set의 단일 관문 — 메모리 갱신 + 영속 스냅샷 예약. */
function cacheSet(url: string, value: unknown) {
  cache.set(url, value);
  schedulePersist();
}

// 부팅 시드: 모듈 로드 시 1회, 마지막 세션의 스냅샷으로 Map을 채운다.
// 소유자 확인 전이지만 즉시 페인트가 목적 — 계정이 실제로 바뀐 경우
// setPageCacheOwner(레이아웃 auth 성공 시)가 전량 폐기하고 재검증이 덮어쓴다.
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: unknown; userId?: unknown; entries?: unknown };
      if (
        parsed &&
        parsed.v === PERSIST_VERSION &&
        parsed.entries &&
        typeof parsed.entries === 'object' &&
        // 소유자 없는 봉투는 신뢰하지 않는다(구버전/경쟁 잔재 방어) — 시드 없이 폐기.
        typeof parsed.userId === 'string'
      ) {
        cacheOwnerId = parsed.userId;
        for (const [k, v] of Object.entries(parsed.entries as Record<string, unknown>)) {
          if (k.startsWith('/api/')) cache.set(k, v);
        }
      }
    }
  } catch {
    // 손상 스냅샷 — 무시하고 빈 캐시로 시작
  }
  // 모바일 PWA는 debounce 타이머가 돌기 전에 프로세스가 죽을 수 있다 — 이탈 시 즉시 플러시.
  window.addEventListener('pagehide', persistNow);
}

/** 인증 확정 시 캐시 소유자 대조 — (app) 레이아웃이 auth/me 성공 후 호출한다.
 *  영속 스냅샷이 다른 계정 것이면(OAuth 리다이렉트 전환 등 clearPageCache를 안 거친
 *  경로) 전량 폐기해 이전 계정 데이터가 새 계정에 비치지 않게 한다. */
export function setPageCacheOwner(userId: string) {
  if (cacheOwnerId && cacheOwnerId !== userId) {
    clearPageCache();
  }
  cacheOwnerId = userId;
  schedulePersist();
}

/** 로그인/로그아웃(사용자 전환) 시 호출 — 이전 계정의 데이터가 새 계정 화면에 비치는 것 방지.
 *  메모리 캐시와 localStorage 영속 스냅샷을 함께 비운다. */
export function clearPageCache() {
  cacheEpoch += 1; // 진행 중이던 응답의 뒤늦은 캐시/영속 쓰기를 전부 무효화
  cache.clear();
  inflight.clear();
  lastSuccessAt.clear();
  cacheOwnerId = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // localStorage 불가 — 무시
  }
}

/** 특정 키만 무효화 (다음 mount에서 스켈레톤부터 시작하게 하고 싶을 때). */
export function invalidateCachedApi(url: string) {
  cache.delete(url);
  lastSuccessAt.delete(url);
  schedulePersist();
}

/** 접두 일치 키 일괄 무효화 — 파라미터화된 상세 캐시 일족(예: '/api/relays')을
 *  키를 모르는 채로 비울 때. 다음 진입은 캐시 없이 서버 기준으로 시작한다. */
export function invalidateCachedApiPrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      lastSuccessAt.delete(key);
    }
  }
  schedulePersist();
}

/** 훅 밖에서 캐시 스냅샷 읽기 — 다른 페이지가 받아둔 응답으로 선렌더할 때 사용
 *  (예: board/[id]가 홈의 /api/boards 캐시에서 보드 요약을 꺼내 제목을 즉시 표시).
 *  하이드레이션 렌더 중에는 undefined — 서버 HTML(캐시 없음)과의 정합을 위해
 *  localStorage 시드는 첫 커밋 이후부터 노출된다(useState 초기값 소비자 공통). */
export function readCachedApi<T>(url: string): T | undefined {
  if (!hydrated) return undefined;
  return cache.get(url) as T | undefined;
}

/** 훅 밖에서 캐시 적재 — 프리페치(홈이 상위 보드 상세를 미리 받아둠)나
 *  페이지 로컬 상태의 스냅샷 동기화(보드 상세의 마지막 상태 보존)용. */
export function writeCachedApi<T>(url: string, value: T) {
  cacheSet(url, value);
}

/** 같은 키의 동시 fetch를 하나로 합치는 공유 fetch — 성공 시각(lastSuccessAt)도 기록.
 *  시작 시점의 epoch를 캡처해, 완료 전에 clearPageCache가 지나갔으면 기록을 버린다. */
function fetchShared<T>(url: string): Promise<T> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const epochAtStart = cacheEpoch;
  const p = api<T>(url)
    .then((fresh) => {
      if (epochAtStart === cacheEpoch) lastSuccessAt.set(url, Date.now());
      return fresh;
    })
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, p);
  return p;
}

export function useCachedApi<T>(url: string) {
  // 하이드레이션 렌더(hydrated=false)에선 서버 HTML과 동일하게 캐시 없음으로 시작 —
  // 시드 데이터는 직후 mount effect의 setData가 그린다(체감 지연 없음, mismatch 없음).
  const [data, setData] = useState<T | undefined>(() =>
    hydrated ? (cache.get(url) as T | undefined) : undefined,
  );
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
    lastRefreshAtRef.current = Date.now();
    setError(false);
    setErrorStatus(undefined);
    const epochAtStart = cacheEpoch;
    try {
      const fresh = await fetchShared<T>(url);
      // 완료 전에 clearPageCache(계정 전환/로그아웃)가 지나갔으면 이 응답은 이전
      // 세션 소속 — 캐시·화면 어디에도 쓰지 않고 버린다(재오염 방지).
      if (epochAtStart !== cacheEpoch) return;
      // 캐시는 자기 url 키로 항상 갱신(정확) — 화면 state만 최신 요청일 때 반영한다.
      cacheSet(url, fresh);
      if (!guardRef.current.isLatest(token)) return;
      setData(fresh);
    } catch (e) {
      if (!guardRef.current.isLatest(token)) return;
      setError(true);
      setErrorStatus(e instanceof ApiError ? e.status : undefined);
    } finally {
      if (guardRef.current.isLatest(token)) setFetched(true);
    }
  }, [url]);

  useEffect(() => {
    // 첫 커밋 도달 = 하이드레이션 종료 — 이후의 모든 마운트는 동기 캐시 읽기 허용.
    hydrated = true;
    // url 전환(같은 훅 인스턴스 — friends/[id]·relay/[id] 등) 시 화면 state를 새 키의
    // 캐시로 즉시 동기화 — 이전 url 데이터가 새 화면에 잔류(stale flash)하지 않게 한다.
    // 신규 마운트에선 초기값과 동일 참조라 React가 리렌더를 생략하는 no-op.
    // (하이드레이션 마운트에선 undefined 초기값 → 여기서 시드가 실제로 그려진다.)
    setData(cache.get(url) as T | undefined);
    // mount 재검증 TTL: 이 키가 방금(≤5초) 성공 응답을 받았다면 재발사하지 않는다.
    // (영속 시드 데이터는 lastSuccessAt 기록이 없어 여기 걸리지 않고 항상 재검증.)
    if (cache.has(url) && Date.now() - (lastSuccessAt.get(url) ?? 0) < MOUNT_REVALIDATE_TTL_MS) {
      // 직전 url의 미완료 요청을 무효화 — TTL 경로는 refresh를 안 타므로 여기서
      // begin()하지 않으면 늦게 도착한 이전 url 응답이 isLatest를 통과해 이 화면을
      // 덮어쓴다(latestGuard가 막으려던 역순 응답 클래스의 재발).
      guardRef.current.begin();
      setError(false);
      setErrorStatus(undefined);
      setFetched(true);
      return;
    }
    // url 전환 잔류 fetched 리셋 — 캐시 없는 새 키가 '빈 상태'가 아니라 스켈레톤으로
    // 보이도록, 자기 재검증이 완료되기 전까지는 미확정으로 되돌린다(신규 마운트에선 no-op).
    setFetched(false);
    refresh();
  }, [refresh, url]);

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
      cacheSet(url, next);
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
