import { OAUTH_PROVIDERS, isRealOAuth } from '@/lib/oauth';

// Tells the UI which social providers have *real* OAuth credentials wired up
// vs. running in guest-fallback mode. The button is clickable either way; the
// UI just shows a "체험" badge on guest-mode buttons.
export async function GET() {
  const providers = Object.fromEntries(
    OAUTH_PROVIDERS.map((p) => [p, { real: isRealOAuth(p), ready: true }]),
  );
  return Response.json({ providers }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
