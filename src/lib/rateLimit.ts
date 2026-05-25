// Minimal in-memory sliding-window rate limiter. Suitable for single-instance
// deployments (Next.js standalone / dev). For multi-instance production, swap
// for Upstash Redis or similar shared store.
//
// Usage:
//   const limit = rateLimit({ windowMs: 60_000, max: 5 });
//   const block = limit(ipKey);
//   if (block) return block;  // 429 response

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Periodic GC so the Map doesn't grow forever. Runs on a coarse interval — we
// don't care about precise expiry, just bounded memory.
const GC_INTERVAL_MS = 5 * 60 * 1000;
let lastGc = Date.now();

function gcIfDue(now: number) {
  if (now - lastGc < GC_INTERVAL_MS) return;
  lastGc = now;
  const threshold = now - 10 * 60 * 1000; // drop buckets idle >10 min
  const toDelete: string[] = [];
  buckets.forEach((b, k) => {
    if (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1] < threshold) {
      toDelete.push(k);
    }
  });
  for (const k of toDelete) buckets.delete(k);
}

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests' } = opts;

  return function check(key: string): Response | null {
    const now = Date.now();
    gcIfDue(now);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(key, bucket);
    }

    const windowStart = now - windowMs;
    // Drop expired entries (keeps the array bounded)
    while (bucket.timestamps.length > 0 && bucket.timestamps[0] < windowStart) {
      bucket.timestamps.shift();
    }

    if (bucket.timestamps.length >= max) {
      const retryAfter = Math.ceil((bucket.timestamps[0] + windowMs - now) / 1000);
      return Response.json(
        { error: message },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfter)),
          },
        },
      );
    }

    bucket.timestamps.push(now);
    return null;
  };
}

// Extract a best-effort client key from request headers. Prefers
// `x-forwarded-for` (first hop) then falls back to a fixed string so the
// limiter still does basic per-process rate limiting.
export function clientKey(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
