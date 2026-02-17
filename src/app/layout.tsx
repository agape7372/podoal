import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '포도알 - 칭찬 스티커 보상표',
  description: '포도알 칭찬 스티커로 목표를 달성하고, 소중한 사람에게 응원을 보내세요!',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#9B7ED8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-clay-bg text-warm-text antialiased">
        {children}
      </body>
    </html>
  );
}
