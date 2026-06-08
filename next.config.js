/** @type {import('next').NextConfig} */
// CSP는 nonce 인프라가 없어 우선 Report-Only로 도입한다(앱 무파손 — 위반은 브라우저가 보고만 함).
// next/font·MaruBuri를 자체 호스팅하므로 외부 origin이 0이라 'self' 위주로 충분하다. 단:
//  - style-src 'unsafe-inline': React 인라인 style={{}} 다수 → 빼면 레이아웃 붕괴
//  - script-src 'unsafe-inline'(+dev 'unsafe-eval'): Next App Router 인라인 부트스트랩/RSC → 빼면 백지화
//  - img-src data: blob:: 공유카드 Canvas(toDataURL)·EmojiIcon /icons svg·아바타
//  - worker-src/manifest-src 'self': PWA(sw.js·manifest)
// 위반 관찰 후 nonce 기반 enforce로 승격하는 게 다음 단계.
const isDev = process.env.NODE_ENV !== 'production';
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

const nextConfig = {
  // Renamed from experimental.serverComponentsExternalPackages (stable since Next 15).
  serverExternalPackages: ['bcryptjs', '@prisma/client', 'prisma'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
