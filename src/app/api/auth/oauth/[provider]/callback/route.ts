import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCodeForToken,
  fetchUserInfo,
  isProviderConfigured,
  OAUTH_PROVIDERS,
  type OAuthProvider,
} from '@/lib/oauth';
import { prisma } from '@/lib/prisma';
import { buildAuthCookie, createToken } from '@/lib/auth';

function redirectHome(origin: string, error?: string) {
  const target = error ? `${origin}/?error=${encodeURIComponent(error)}` : `${origin}/home`;
  const clearStateCookie = [
    'oauth_state=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') clearStateCookie.push('Secure');
  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Set-Cookie': clearStateCookie.join('; ') },
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
  if (!isProviderConfigured(provider)) {
    return redirectHome(origin, `oauth_not_configured:${provider}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return redirectHome(origin, `oauth_${provider}_${errorParam}`);
  }
  if (!code || !state) {
    return redirectHome(origin, `oauth_${provider}_missing_code`);
  }

  const savedState = cookies().get('oauth_state')?.value;
  if (!savedState || savedState !== state) {
    return redirectHome(origin, `oauth_${provider}_bad_state`);
  }

  const base = process.env.OAUTH_REDIRECT_BASE || origin;
  const redirectUri = `${base}/api/auth/oauth/${provider}/callback`;

  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(provider, code, redirectUri);
  } catch (err) {
    console.error(`OAuth token exchange failed (${provider}):`, err);
    return redirectHome(origin, `oauth_${provider}_token_failed`);
  }

  let userInfo;
  try {
    userInfo = await fetchUserInfo(provider, accessToken);
  } catch (err) {
    console.error(`OAuth user info fetch failed (${provider}):`, err);
    return redirectHome(origin, `oauth_${provider}_userinfo_failed`);
  }

  // Upsert the user: prefer matching by (provider, providerId), then by email.
  let user = await prisma.user.findFirst({
    where: { provider, providerId: userInfo.id },
  });

  if (!user && userInfo.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: userInfo.email } });
    if (byEmail) {
      if (byEmail.provider && byEmail.provider !== provider) {
        // Existing account is tied to a different OAuth provider with the same email.
        // Don't silently overwrite — surface a clear error so the user can use the
        // original provider instead.
        return redirectHome(origin, `oauth_email_taken_by_${byEmail.provider}`);
      }
      // Either no provider (email signup) or same provider with stale providerId — link.
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { provider, providerId: userInfo.id },
      });
    }
  }

  if (!user) {
    // Brand new user.
    const placeholderEmail = userInfo.email || `${provider}_${userInfo.id}@podoal.local`;
    try {
      user = await prisma.user.create({
        data: {
          name: userInfo.name,
          email: placeholderEmail,
          password: null,
          provider,
          providerId: userInfo.id,
          avatar: 'grape',
        },
      });
    } catch (err: any) {
      console.error(`OAuth user creation failed (${provider}):`, err);
      return redirectHome(origin, `oauth_${provider}_create_failed`);
    }
  }

  const token = await createToken(user.id);
  const clearStateCookie = [
    'oauth_state=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') clearStateCookie.push('Secure');

  const res = new Response(null, {
    status: 302,
    headers: { Location: `${origin}/home` },
  });
  res.headers.append('Set-Cookie', buildAuthCookie(token));
  res.headers.append('Set-Cookie', clearStateCookie.join('; '));
  return res;
}
