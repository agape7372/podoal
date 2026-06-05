import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { buildAuthorizeUrl, isRealOAuth, OAUTH_PROVIDERS, type OAuthProvider } from '@/lib/oauth';

function stateCookie(value: string, maxAge: number): string {
  const parts = [
    `oauth_state=${value}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

// Starts the OAuth dance. If the provider has real credentials, redirect to
// its consent page. Otherwise, route directly to our callback with a
// `?guest=1` flag — the callback will create a randomized guest account so
// the button still "works" without external OAuth setup.
export async function GET(request: NextRequest, props: { params: Promise<{ provider: string }> }) {
  const params = await props.params;
  const provider = params.provider as OAuthProvider;
  if (!OAUTH_PROVIDERS.includes(provider)) {
    return new Response('Unknown provider', { status: 404 });
  }

  const state = randomBytes(16).toString('base64url');
  const base = process.env.OAUTH_REDIRECT_BASE || new URL(request.url).origin;

  if (!isRealOAuth(provider)) {
    // Guest fallback: skip provider redirect entirely.
    const guestUrl = `${base}/api/auth/oauth/${provider}/callback?guest=1&state=${state}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: guestUrl,
        'Set-Cookie': stateCookie(state, 300),
      },
    });
  }

  const redirectUri = `${base}/api/auth/oauth/${provider}/callback`;
  const authorizeUrl = buildAuthorizeUrl(provider, state, redirectUri);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': stateCookie(state, 300),
    },
  });
}
