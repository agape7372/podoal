import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  decideAccountMerge,
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
import { clientKey, rateLimit } from '@/lib/rateLimit';

// 게스트 계정 대량 생성(봇 스팸) 방지 — IP당 제한.
const guestLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 5,
  message: '게스트 로그인을 너무 자주 시도했어요. 잠시 후 다시 시도해주세요.',
});

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

export async function GET(request: NextRequest, props: { params: Promise<{ provider: string }> }) {
  const params = await props.params;
  const provider = params.provider as OAuthProvider;
  const url = new URL(request.url);
  const origin = url.origin;

  if (!OAUTH_PROVIDERS.includes(provider)) {
    return new Response('Unknown provider', { status: 404 });
  }

  const state = url.searchParams.get('state');
  const savedState = (await cookies()).get('oauth_state')?.value;
  if (!savedState || !state || savedState !== state) {
    return redirectWithError(origin, `oauth_${provider}_bad_state`);
  }

  // Path A: guest fallback — 서버 설정(자격증명 부재)으로만 결정한다. 클라이언트가
  // 보낸 ?guest=1 은 신뢰하지 않는다: 실제 OAuth가 구성된 경우 위조된 guest=1 로
  // provider 로그인을 우회할 수 없어야 한다. 봇 대량가입 방지를 위해 IP 레이트리밋 적용.
  if (!isRealOAuth(provider)) {
    const blocked = await guestLimit(clientKey(request));
    if (blocked) return blocked;
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
    const decision = decideAccountMerge(byEmail, providerTag);
    // 비밀번호 계정(provider=null)으로의 자동 병합은 계정 탈취 경로라 거부한다
    // (decideAccountMerge 주석 참조). 다른 provider 소유 email도 동일하게 거부.
    if (decision.action === 'reject') {
      return redirectWithError(origin, `oauth_email_taken_by_${decision.reason}`);
    }
    if (decision.action === 'merge' && byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { provider: providerTag, providerId: userInfo.id },
      });
    }
    // decision.action === 'create' 는 아래 생성 블록으로 자연 낙하한다.
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
