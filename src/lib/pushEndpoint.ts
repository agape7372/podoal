/**
 * Web Push 구독값 검증 — 순수 함수만. `push/subscribe` 라우트가 저장 전에 쓴다.
 *
 * 왜 필요한가(감사 H-03): 서버는 저장된 endpoint URL로 스스로 HTTPS 요청을 보낸다.
 * 검증이 없으면 인증 사용자가 임의 호스트를 저장해 서버발 요청을 유발할 수 있다
 * (blind SSRF). 구독을 잔뜩 만들면 알림 한 번의 fanout 비용도 그만큼 증폭된다.
 *
 * ⚠ 한계: 저장 시점의 1회 검사는 DNS rebinding을 막지 못한다. 저장할 때 공인 IP로
 * 해석되던 호스트가 발송 시점에 내부 IP로 바뀔 수 있다. 근본 차단은 egress 방화벽의
 * 몫이고, 여기서는 명백한 사례(비-HTTPS, IP 리터럴, 사설/루프백 대역, 내부 도메인)를
 * 값싸게 걷어낸다.
 */

/** 알려진 브라우저 push provider. PUSH_ENDPOINT_ALLOWLIST=strict일 때만 강제된다. */
const KNOWN_PROVIDER_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

const MAX_ENDPOINT_LENGTH = 2048;

export type Verdict = { ok: true } | { ok: false; reason: string };

const OK: Verdict = { ok: true };
const deny = (reason: string): Verdict => ({ ok: false, reason });

function isIpv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIpv6Literal(host: string): boolean {
  // URL.hostname은 IPv6를 대괄호로 감싸 돌려준다. 대괄호를 벗겨도 콜론이 남으면 리터럴.
  return host.includes(':');
}

/** 공인 대역이 아닌 IPv4 — 루프백·사설·링크로컬·CGNAT·미지정. */
function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local (클라우드 메타데이터 포함)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::' || h === '::1') return true;
  if (/^f[cd]/.test(h)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(h)) return true; // fe80::/10 link-local
  return false;
}

/**
 * endpoint URL이 외부 push provider로 보내기에 안전한 형태인지 판정한다.
 * allowlistMode='strict'이면 알려진 provider 호스트만 통과시킨다(기본은 비강제 —
 * 알려지지 않은 브라우저의 정상 provider를 기본값으로 막지 않기 위함).
 */
export function validatePushEndpoint(
  endpoint: unknown,
  allowlistMode?: string
): Verdict {
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return deny('endpoint가 비어 있습니다.');
  }
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    return deny(`endpoint가 너무 깁니다(최대 ${MAX_ENDPOINT_LENGTH}자).`);
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return deny('endpoint를 URL로 해석할 수 없습니다.');
  }

  if (url.protocol !== 'https:') {
    return deny('endpoint는 https여야 합니다.');
  }
  if (url.username || url.password) {
    return deny('endpoint에 자격증명을 포함할 수 없습니다.');
  }

  const host = url.hostname.toLowerCase();
  if (!host) return deny('endpoint에 호스트가 없습니다.');

  if (isIpv6Literal(host)) {
    return isPrivateIpv6(host) ? deny('내부 주소로는 보낼 수 없습니다.') : deny('endpoint에 IP 주소를 쓸 수 없습니다.');
  }
  if (isIpv4Literal(host)) {
    return isPrivateIpv4(host) ? deny('내부 주소로는 보낼 수 없습니다.') : deny('endpoint에 IP 주소를 쓸 수 없습니다.');
  }

  // 내부 전용 이름공간. 점이 없는 단일 라벨(예: 'intranet')도 내부 호스트다.
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') || !host.includes('.')) {
    return deny('내부 도메인으로는 보낼 수 없습니다.');
  }

  if (allowlistMode === 'strict') {
    const known = KNOWN_PROVIDER_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
    if (!known) return deny('알려진 push provider가 아닙니다.');
  }

  return OK;
}

/** base64url 문자열이 디코딩됐을 때의 바이트 수. 형식이 틀리면 null. */
export function base64UrlByteLength(value: string): number | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  const body = value.replace(/=+$/, '');
  if (body.length % 4 === 1) return null; // base64로 나올 수 없는 길이
  return Math.floor((body.length * 3) / 4);
}

/**
 * 구독 키 검증. p256dh는 비압축 P-256 공개키(65바이트), auth는 인증 시크릿(16바이트)이다.
 * 길이가 맞지 않으면 web-push가 발송 시점에 던지는데, 그때는 이미 저장된 뒤라 조용한
 * 실패로만 보인다 — 저장 시점에 거른다.
 */
export function validatePushKeys(p256dh: unknown, auth: unknown): Verdict {
  if (typeof p256dh !== 'string' || p256dh.length === 0) return deny('p256dh 키가 비어 있습니다.');
  if (typeof auth !== 'string' || auth.length === 0) return deny('auth 키가 비어 있습니다.');

  const pLen = base64UrlByteLength(p256dh);
  if (pLen === null) return deny('p256dh 키가 base64url 형식이 아닙니다.');
  if (pLen !== 65) return deny('p256dh 키 길이가 올바르지 않습니다.');

  const aLen = base64UrlByteLength(auth);
  if (aLen === null) return deny('auth 키가 base64url 형식이 아닙니다.');
  if (aLen !== 16) return deny('auth 키 길이가 올바르지 않습니다.');

  return OK;
}

/** 사용자 1명이 보유할 수 있는 구독 수 상한 — 초과분은 오래된 것부터 정리한다. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;
