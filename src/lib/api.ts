'use client';

/** HTTP 응답이 도착했지만 non-OK였던 실패. 네트워크 단절(fetch TypeError)과 달리
 *  상태 코드가 존재하므로, '권한 상실(403/404)'과 '일시 장애(5xx·오프라인 SW 503)'를
 *  구분해 반응해야 하는 소비자가 instanceof로 식별한다. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...fetchOptions } = options || {};

  const res = await fetch(path, {
    ...fetchOptions,
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...fetchOptions?.headers,
    },
    body: json ? JSON.stringify(json) : fetchOptions?.body,
  });

  // 응답이 JSON이 아닐 수 있다(500 HTML 에러 페이지·502/504 게이트웨이·빈 본문 등).
  // 그대로 res.json()하면 SyntaxError가 터져 진짜 상태/원인을 가린다 → 방어적으로 파싱.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const serverMsg =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;
    throw new ApiError(serverMsg || `요청에 실패했어요 (${res.status})`, res.status);
  }

  return data as T;
}

type MeUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider?: string | null;
  analyticsConsentAt?: string | null;
  createdAt?: string;
  /** "하루의 시작" 시각(0~6, C4-b additive) — auth/me만 내려준다. */
  dayResetHour?: number;
};

/** fetchUser의 '일시 장애' 결과 — 네트워크 단절·5xx·오프라인 SW 503 등, 세션의
 *  유효/무효를 판정할 수 없는 실패. null(확정 미인증: 401/404)과 반드시 구분한다 —
 *  구분 없이 null로 뭉개면 비행기 모드에서 앱을 연 사용자가 로그아웃당하고
 *  영속 캐시까지 전소된다(레이아웃의 미인증 처리 경로). */
export const FETCH_USER_TRANSIENT = 'transient-error' as const;
export type FetchUserResult = MeUser | null | typeof FETCH_USER_TRANSIENT;

// fetchUser 성공 결과 단기 메모 — '/' 진입(웰컴의 auth 확인)과 (app) 레이아웃 mount가
// 몇 초 간격으로 같은 /api/auth/me를 연달아 부르던 중복을 없앤다. 실패/미로그인은
// 메모하지 않으므로(로그인 직후 등) 다음 호출이 즉시 재확인한다.
const USER_FETCH_TTL_MS = 10_000;
let userFetchMemo: { at: number; promise: Promise<FetchUserResult> } | null = null;

export async function fetchUser(): Promise<FetchUserResult> {
  if (userFetchMemo && Date.now() - userFetchMemo.at < USER_FETCH_TTL_MS) {
    return userFetchMemo.promise;
  }
  const memo = {
    at: Date.now(),
    promise: (async (): Promise<FetchUserResult> => {
      try {
        const data = await api<{ user: MeUser }>('/api/auth/me');
        return data.user;
      } catch (e) {
        // 401(미인증)/404(계정 삭제)만 '확정 로그아웃'. 그 외는 판정 불가.
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null;
        return FETCH_USER_TRANSIENT;
      }
    })(),
  };
  userFetchMemo = memo;
  const user = await memo.promise;
  if ((!user || user === FETCH_USER_TRANSIENT) && userFetchMemo === memo) userFetchMemo = null;
  return user;
}
