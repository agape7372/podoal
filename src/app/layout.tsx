import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Body: Noto Sans KR self-hosted + subset by next/font (no render-blocking @import).
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
  preload: false, // large CJK family — avoid preloading the whole file
});

// Display: MaruBuri self-hosted from ./fonts (was a dead third-party CDN @font-face).
const maruBuri = localFont({
  src: [
    { path: './fonts/MaruBuri-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/MaruBuri-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/MaruBuri-Bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'podoal — 한 알씩, 매일의 기록',
  description: '포도알을 한 알씩 채우며 목표를 달성하고, 소중한 사람에게 응원과 보상을 주고받아요.',
  manifest: '/manifest.json',
  // 브라우저 기본 /favicon.ico 요청(404)을 막기 위해 아이콘을 명시(현재 SVG만 존재 — PNG 세트는 추후).
  icons: {
    icon: '/icons/icon.svg',
    shortcut: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // allow pinch-zoom (WCAG 1.4.4). iOS focus-zoom is avoided via 16px inputs.
  maximumScale: 5,
  userScalable: true,
  themeColor: '#DCC4F2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${maruBuri.variable}`}>
      <head>
        {/* mobile-web-app-capable는 표준, apple-* 은 구형 iOS 호환용으로 병행 */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className="min-h-dvh bg-clay-bg text-warm-text antialiased">
        {children}
      </body>
    </html>
  );
}
