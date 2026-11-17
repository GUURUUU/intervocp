/**
 * Login attempt limiter (per account).
 *
 * Five failed attempts within 15 minutes lock the account for 15 minutes.
 * State is kept in memory: it protects a single Node process, which is the
 * deployment model of this app (`next start`). For a multi-instance
 * deployment, move the same buckets to Redis without changing the callers.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Bucket {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size < 1_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil < now && now - bucket.windowStart > WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitState {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Checks whether a login attempt is currently allowed for this key. */
export function checkLoginRateLimit(key: string): RateLimitState {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true, retryAfterSeconds: 0 };

  if (bucket.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Records a failed attempt and locks the key when the limit is reached. */
export function registerLoginFailure(key: string): void {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, {
      failures: 1,
      windowStart: now,
      lockedUntil: 0,
    });
    return;
  }

  bucket.failures += 1;
  if (bucket.failures >= MAX_ATTEMPTS) {
    bucket.lockedUntil = now + WINDOW_MS;
    bucket.failures = 0;
    bucket.windowStart = now;
  }
}

/** Clears the counter after a successful sign-in. */
export function clearLoginFailures(key: string): void {
  buckets.delete(key);
}
