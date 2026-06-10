'use client';

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
    throw new Error(serverMsg || `요청에 실패했어요 (${res.status})`);
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
