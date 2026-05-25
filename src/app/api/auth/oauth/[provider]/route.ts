import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { buildAuthorizeUrl, getProviderConfig, isProviderConfigured, OAUTH_PROVIDERS, type OAuthProvider } from '@/lib/oauth';

// Starts the OAuth dance: sets a CSRF-protection cookie and redirects
// the user to the provider's consent page.
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider as OAuthProvider;
  if (!OAUTH_PROVIDERS.includes(provider)) {
    return new Response('Unknown provider', { status: 404 });
  }
  if (!isProviderConfigured(provider)) {
    // Redirect home with an error param so the UI can surface it instead of
    // dropping the user on a blank 500 page.
    const origin = new URL(request.url).origin;
    return Response.redirect(`${origin}/?error=oauth_not_configured&provider=${provider}`, 302);
  }

  const state = randomBytes(16).toString('base64url');
  const base = process.env.OAUTH_REDIRECT_BASE || new URL(request.url).origin;
  const redirectUri = `${base}/api/auth/oauth/${provider}/callback`;
  const authorizeUrl = buildAuthorizeUrl(provider, state, redirectUri);

  const cookieParts = [
    `oauth_state=${state}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=300',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') cookieParts.push('Secure');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': cookieParts.join('; '),
    },
  });
}
