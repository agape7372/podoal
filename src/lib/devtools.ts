// Dev-only tooling gate.
//
// Enabled automatically during local development. In production it is OFF
// unless you explicitly opt in with `NEXT_PUBLIC_DEV_TOOLS=1` (e.g. on a
// Vercel preview deployment you want to manually test against).
//
// The `NEXT_PUBLIC_` prefix means this value is inlined into the client
// bundle, so the SAME flag gates both the UI (which dev buttons render) and
// the server route handlers (whether the dev endpoints respond at all).
export const DEV_TOOLS =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_DEV_TOOLS === '1';
