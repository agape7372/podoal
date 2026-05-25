// OAuth provider integration for Google, Kakao, Naver.
//
// Two-mode design:
//   1. REAL OAuth — when CLIENT_ID (and CLIENT_SECRET, except Kakao) is set:
//      Standard OAuth 2.0 Authorization Code flow:
//        a. Redirect user to provider's authorize URL with our client_id + state
//        b. Provider redirects back with `code` + our `state`
//        c. We exchange code → access_token, fetch user info, upsert + JWT
//
//   2. GUEST fallback — when credentials are missing:
//      Buttons still work end-to-end. Clicking creates a freshly randomized
//      "guest" account branded with that provider's color so the user can
//      try the app without you having to register OAuth apps on every
//      provider's console up front. As soon as you add real CLIENT_ID +
//      CLIENT_SECRET on Vercel, the matching button silently switches to
//      real OAuth — no UI change required.
//
// State (CSRF) is validated via a short-lived HttpOnly cookie set at step a.

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

// Real OAuth = provider's credentials are present. Kakao tolerates a missing
// client_secret (their console makes it optional); Google/Naver require both.
export function isRealOAuth(provider: OAuthProvider): boolean {
  const c = getProviderConfig(provider);
  if (provider === 'kakao') return !!c.clientId;
  return !!c.clientId && !!c.clientSecret;
}

// All providers are "ready" — either real OAuth or guest fallback. The UI
// uses this to keep every button clickable; the badge differentiates the modes.
export function isProviderConfigured(provider: OAuthProvider): boolean {
  return isRealOAuth(provider) || true; // guest fallback always available
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

// ─── Guest fallback ───────────────────────────────────────────
// When a provider has no CLIENT_ID set, the OAuth button still creates a
// usable account. We generate a Korean-friendly randomized identity tagged
// with the provider so the app stays "operational" while real OAuth is
// being set up. Each call returns a unique identity.

const GUEST_FRUIT_ADJECTIVES = [
  '달콤한', '새콤한', '향긋한', '신선한', '익은', '말랑한',
  '반짝이는', '귀여운', '용감한', '느긋한', '활기찬', '포근한',
  '톡톡한', '싱그러운', '쫀득한', '맑은',
];
const GUEST_FRUIT_NOUNS = [
  '포도', '복숭아', '자두', '사과', '귤', '딸기',
  '체리', '망고', '레몬', '키위', '바나나', '배',
  '감', '수박', '멜론', '블루베리',
];

export function generateGuestIdentity(provider: OAuthProvider): NormalizedUserInfo {
  const adj = GUEST_FRUIT_ADJECTIVES[Math.floor(Math.random() * GUEST_FRUIT_ADJECTIVES.length)];
  const noun = GUEST_FRUIT_NOUNS[Math.floor(Math.random() * GUEST_FRUIT_NOUNS.length)];
  // A random suffix so the same adj+noun can co-exist for multiple users.
  const suffix = Math.random().toString(36).slice(2, 8);
  const id = `guest_${provider}_${Date.now()}_${suffix}`;
  return {
    id,
    email: null, // guest accounts have no real email
    name: `${adj} ${noun}`,
  };
}
