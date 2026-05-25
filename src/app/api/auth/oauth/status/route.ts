import { OAUTH_PROVIDERS, isProviderConfigured } from '@/lib/oauth';

// Tells the UI which social providers are wired up so it can render them
// as "ready" vs "준비 중" without exposing any secrets.
export async function GET() {
  const status = Object.fromEntries(
    OAUTH_PROVIDERS.map((p) => [p, isProviderConfigured(p)]),
  ) as Record<typeof OAUTH_PROVIDERS[number], boolean>;
  return Response.json({ providers: status }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
