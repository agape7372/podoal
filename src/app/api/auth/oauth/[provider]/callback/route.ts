import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCodeForToken,
  fetchUserInfo,
  generateGuestIdentity,
  isRealOAuth,
  OAUTH_PROVIDERS,
  type NormalizedUserInfo,
  type OAuthProvider,
} from '@/lib/oauth';
import { prisma } from '@/lib/prisma';
import { buildAuthCookie, createToken } from '@/lib/auth';

function clearStateHeader(): string {
  const parts = [
    'oauth_state=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function redirectWithError(origin: string, error: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/?error=${encodeURIComponent(error)}`,
      'Set-Cookie': clearStateHeader(),
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider as OAuthProvider;
  const url = new URL(request.url);
  const origin = url.origin;

  if (!OAUTH_PROVIDERS.includes(provider)) {
    return new Response('Unknown provider', { status: 404 });
  }

  const state = url.searchParams.get('state');
  const savedState = cookies().get('oauth_state')?.value;
  if (!savedState || !state || savedState !== state) {
    return redirectWithError(origin, `oauth_${provider}_bad_state`);
  }

  // Path A: guest fallback (no real OAuth credentials for this provider).
  const isGuest = url.searchParams.get('guest') === '1';
  if (isGuest || !isRealOAuth(provider)) {
    const guest = generateGuestIdentity(provider);
    return await finalizeLogin(origin, provider, guest, { guest: true });
  }

  // Path B: real OAuth flow.
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return redirectWithError(origin, `oauth_${provider}_${errorParam}`);
  if (!code) return redirectWithError(origin, `oauth_${provider}_missing_code`);

  const base = process.env.OAUTH_REDIRECT_BASE || origin;
  const redirectUri = `${base}/api/auth/oauth/${provider}/callback`;

  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(provider, code, redirectUri);
  } catch (err) {
    console.error(`OAuth token exchange failed (${provider}):`, err);
    return redirectWithError(origin, `oauth_${provider}_token_failed`);
  }

  let userInfo: NormalizedUserInfo;
  try {
    userInfo = await fetchUserInfo(provider, accessToken);
  } catch (err) {
    console.error(`OAuth user info fetch failed (${provider}):`, err);
    return redirectWithError(origin, `oauth_${provider}_userinfo_failed`);
  }

  return await finalizeLogin(origin, provider, userInfo, { guest: false });
}

async function finalizeLogin(
  origin: string,
  provider: OAuthProvider,
  userInfo: NormalizedUserInfo,
  opts: { guest: boolean },
): Promise<Response> {
  // Tag guest accounts with a dedicated provider string so the existing
  // (provider, providerId) unique index keeps them distinct from real
  // accounts that may share the same email in the future.
  const providerTag = opts.guest ? `${provider}_guest` : provider;

  let user = await prisma.user.findFirst({
    where: { provider: providerTag, providerId: userInfo.id },
  });

  if (!user && userInfo.email && !opts.guest) {
    const byEmail = await prisma.user.findUnique({ where: { email: userInfo.email } });
    if (byEmail) {
      if (byEmail.provider && byEmail.provider !== providerTag) {
        return redirectWithError(origin, `oauth_email_taken_by_${byEmail.provider}`);
      }
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { provider: providerTag, providerId: userInfo.id },
      });
    }
  }

  if (!user) {
    const placeholderEmail = userInfo.email || `${providerTag}_${userInfo.id}@podoal.local`;
    try {
      user = await prisma.user.create({
        data: {
          name: userInfo.name,
          email: placeholderEmail,
          password: null,
          provider: providerTag,
          providerId: userInfo.id,
          avatar: 'grape',
        },
      });
    } catch (err) {
      console.error(`OAuth user creation failed (${providerTag}):`, err);
      return redirectWithError(origin, `oauth_${provider}_create_failed`);
    }
  }

  const token = await createToken(user.id);
  const res = new Response(null, {
    status: 302,
    headers: { Location: `${origin}/home` },
  });
  res.headers.append('Set-Cookie', buildAuthCookie(token));
  res.headers.append('Set-Cookie', clearStateHeader());
  return res;
}
