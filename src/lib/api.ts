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

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API Error: ${res.status}`);
  }

  return data as T;
}

export async function fetchUser() {
  try {
    const data = await api<{ user: { id: string; name: string; email: string; avatar: string } }>('/api/auth/me');
    return data.user;
  } catch {
    return null;
  }
}
