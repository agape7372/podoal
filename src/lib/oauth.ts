// OAuth provider integration for Google, Kakao, Naver.
//
// All providers follow the standard OAuth 2.0 Authorization Code flow:
//   1. Redirect user to provider's authorize URL with our client_id, redirect_uri, state
//   2. Provider redirects back to our /callback with a `code` and our `state`
//   3. We exchange the code for an access_token (server-to-server with client_secret)
//   4. We fetch user info with the access_token and normalize it
//   5. We upsert the user in our DB and issue our own JWT cookie
//
// State (CSRF) is validated via a short-lived HttpOnly cookie set at step 1.

export type OAuthProvider = 'google' | 'kakao' | 'naver';

export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'kakao', 'naver'];

export type NormalizedUserInfo = {
  id: string;        // provider's user id (string)
  email: string | null;  // may be null if user didn't grant email scope
  name: string;      // display name
};

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  normalize: (raw: any) => NormalizedUserInfo | null;
  // Some providers need extra query params on authorize (e.g. naver wants `response_type=code`)
  extraAuthorizeParams?: Record<string, string>;
};

function googleConfig(): ProviderConfig {
  return {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    normalize: (raw) => {
      if (!raw?.sub) return null;
      return {
        id: String(raw.sub),
        email: raw.email || null,
        name: raw.name || raw.given_name || raw.email?.split('@')[0] || '구글 친구',
      };
    },
  };
}

function kakaoConfig(): ProviderConfig {
  return {
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
    scope: 'account_email profile_nickname',
    clientId: process.env.KAKAO_CLIENT_ID || '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    normalize: (raw) => {
      if (!raw?.id) return null;
      const account = raw.kakao_account || {};
      const profile = account.profile || {};
      return {
        id: String(raw.id),
        email: account.email || null,
        name: profile.nickname || '카카오 친구',
      };
    },
  };
}

function naverConfig(): ProviderConfig {
  return {
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    userInfoUrl: 'https://openapi.naver.com/v1/nid/me',
    scope: 'name email',
    clientId: process.env.NAVER_CLIENT_ID || '',
    clientSecret: process.env.NAVER_CLIENT_SECRET || '',
    extraAuthorizeParams: { response_type: 'code' },
    normalize: (raw) => {
      const r = raw?.response;
      if (!r?.id) return null;
      return {
        id: String(r.id),
        email: r.email || null,
        name: r.name || r.nickname || '네이버 친구',
      };
    },
  };
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  switch (provider) {
    case 'google': return googleConfig();
    case 'kakao': return kakaoConfig();
    case 'naver': return naverConfig();
  }
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  const c = getProviderConfig(provider);
  // Kakao can be used without a client secret (it's optional in their console)
  if (provider === 'kakao') return !!c.clientId;
  return !!c.clientId && !!c.clientSecret;
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string,
): string {
  const c = getProviderConfig(provider);
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: c.scope,
    state,
    ...(c.extraAuthorizeParams || {}),
  });
  return `${c.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<string> {
  const c = getProviderConfig(provider);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: c.clientId,
  });
  if (c.clientSecret) body.set('client_secret', c.clientSecret);

  const res = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const token = json.access_token;
  if (!token) throw new Error('No access_token in token response');
  return token;
}

export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string,
): Promise<NormalizedUserInfo> {
  const c = getProviderConfig(provider);
  const res = await fetch(c.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`User info fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const raw = await res.json();
  const normalized = c.normalize(raw);
  if (!normalized) throw new Error('Failed to normalize user info');
  return normalized;
}
