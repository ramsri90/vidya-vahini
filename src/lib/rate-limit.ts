/**
 * In-Memory Rate Limiter for Authentication Endpoints (/login, /change-password)
 *
 * Rule: Maximum 5 attempts per 15 minutes per identifier.
 *
 * Note: In-memory rate limiting is isolated per Node.js process. In single-instance
 * deployments or serverless functions with warm containers, this provides effective brute-force
 * mitigation with zero latency overhead and no external Redis dependency.
 */

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Periodically clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now - record.firstAttemptAt > WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

export function checkRateLimit(rawIdentifier: string): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const key = rawIdentifier.trim().toLowerCase();
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) {
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS,
      resetInSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  // Check if window has expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    rateLimitMap.delete(key);
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS,
      resetInSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.count);
  const resetInSeconds = Math.ceil((record.firstAttemptAt + WINDOW_MS - now) / 1000);

  return {
    allowed: record.count < MAX_ATTEMPTS,
    remaining,
    resetInSeconds,
  };
}

export function recordRateLimitAttempt(rawIdentifier: string): void {
  const key = rawIdentifier.trim().toLowerCase();
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
  }
}

export function resetRateLimit(rawIdentifier: string): void {
  const key = rawIdentifier.trim().toLowerCase();
  rateLimitMap.delete(key);
}
