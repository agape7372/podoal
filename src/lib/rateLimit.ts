// Pluggable rate limiter.
//
//  - No env set  → in-memory sliding window (single instance / dev). Same behavior
//    as before, just wrapped behind an async interface.
//  - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set → shared fixed-window
//    counter in Upstash Redis (correct across Vercel's many lambdas), via the REST
//    API over plain fetch — NO new npm dependency (avoids the cross-platform
//    lockfile churn this repo has fought). Mirrors src/lib/push.ts's env gate.
//
// `check` is async (Upstash is a network call); all call sites must `await` it.
//
// Usage:
//   const limit = rateLimit({ windowMs: 60_000, max: 5 });
//   const block = await limit(ipKey);
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

// In-memory sliding window. Returns the Retry-After seconds if blocked, else null.
function inMemoryBlocked(key: string, windowMs: number, max: number): number | null {
  const now = Date.now();
  gcIfDue(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  const windowStart = now - windowMs;
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] < windowStart) {
    bucket.timestamps.shift();
  }

  if (bucket.timestamps.length >= max) {
    return Math.ceil((bucket.timestamps[0] + windowMs - now) / 1000);
  }

  bucket.timestamps.push(now);
  return null;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const upstashEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN);

// Shared fixed-window counter via Upstash REST. One round trip:
//   INCR key            → current count in this window
//   EXPIRE key ttl NX   → set TTL only on the first hit (keeps the window fixed)
// Returns true if the request should be blocked.
async function upstashBlocked(redisKey: string, ttlSec: number, max: number): Promise<boolean> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, String(ttlSec), 'NX'],
    ]),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Upstash REST ${res.status}`);
  const data = (await res.json()) as Array<{ result?: number; error?: string }>;
  if (data[0]?.error) throw new Error(data[0].error);
  if (data[1]?.error) throw new Error(data[1].error); // EXPIRE NX 실패도 가시화(키 TTL 누락 방지)
  const count = Number(data[0]?.result ?? 0);
  return count > max;
}

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests' } = opts;
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));

  const blockResponse = (retryAfter: number): Response =>
    Response.json(
      { error: message },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } },
    );

  return async function check(key: string): Promise<Response | null> {
    if (upstashEnabled) {
      try {
        const bucket = Math.floor(Date.now() / windowMs);
        const redisKey = `rl:${windowMs}:${max}:${key}:${bucket}`;
        // +1s so the key outlives the window edge before it naturally rolls.
        const blocked = await upstashBlocked(redisKey, ttlSec + 1, max);
        return blocked ? blockResponse(ttlSec) : null;
      } catch (err) {
        // Fail open: a rate-limit backend outage must not lock real users out of
        // a habit app. Log and allow. (We do NOT fall back to the per-instance
        // in-memory store here — mixing the two gives inconsistent limits.)
        console.error('rateLimit: Upstash error, failing open:', err);
        return null;
      }
    }

    const retryAfter = inMemoryBlocked(key, windowMs, max);
    return retryAfter === null ? null : blockResponse(retryAfter);
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
