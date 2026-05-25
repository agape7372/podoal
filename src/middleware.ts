import { NextRequest, NextResponse } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Same-origin CSRF protection: every mutating /api/* request must carry an
// Origin (or Referer) header that matches the request host. Browsers always
// send Origin on cross-site POST/fetch, so a mismatch indicates a CSRF attempt
// (or a misconfigured client).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (!MUTATING_METHODS.has(request.method)) return NextResponse.next();

  const host = request.headers.get('host');
  if (!host) {
    return NextResponse.json({ error: 'Missing host header' }, { status: 400 });
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  const isAllowed =
    matchesHost(origin, host) || (origin === null && matchesHost(referer, host));

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'CSRF: cross-origin request rejected' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

function matchesHost(originOrReferer: string | null, host: string): boolean {
  if (!originOrReferer) return false;
  try {
    const url = new URL(originOrReferer);
    return url.host === host;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
