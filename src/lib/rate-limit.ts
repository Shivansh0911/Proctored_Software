import "server-only";

interface Bucket {
  count: number;
  windowStart: number;
}

// Best-effort, in-memory, per-instance sliding-window limiter. Good enough to
// blunt a runaway client or script hammering an endpoint; it is NOT a
// distributed rate limit — a multi-instance deployment (e.g. several Vercel
// serverless instances under load) each track their own counters. For a
// strict, cross-instance guarantee, back this with Upstash Redis or Vercel KV
// instead and keep the same checkRateLimit(key, limit, windowMs) signature.
const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10000;

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    if (buckets.size > MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
