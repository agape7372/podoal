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

export async function fetchUser() {
  try {
    const data = await api<{ user: { id: string; name: string; email: string; avatar: string; provider?: string | null } }>('/api/auth/me');
    return data.user;
  } catch {
    return null;
  }
}
