/**
 * Shared guard for the EXO proxy endpoints — these spend the OWNER'S Google
 * quota, so they answer only the site itself and only at a human pace.
 *
 * - Browser-origin check: same-origin fetches (Sec-Fetch-Site) or an
 *   allowlisted Origin/Referer. Bare curl gets a 403 — not bulletproof
 *   (headers can be forged), but it keeps the endpoint out of the "free
 *   Gemini proxy" bin. The rate limit is the real backstop.
 * - Per-IP token bucket + a per-instance hourly ceiling so a hot loop can
 *   never run the quota dry. Limits fail CLOSED for the caller but the site
 *   degrades gracefully (canned bank / silent typing).
 */
const ALLOWED = /^https:\/\/(www\.)?exody\.ai$/;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function originOk(req) {
  const sfs = String(req.headers["sec-fetch-site"] || "");
  if (sfs === "same-origin" || sfs === "same-site") return true;
  const origin = String(req.headers.origin || "");
  if (ALLOWED.test(origin) || LOCAL.test(origin)) return true;
  const ref = String(req.headers.referer || "");
  try {
    if (ref) {
      const o = new URL(ref).origin;
      if (ALLOWED.test(o) || LOCAL.test(o)) return true;
    }
  } catch {
    // fall through
  }
  return false;
}

const buckets = new Map();
let hourWindow = 0;
let hourCount = 0;

export function rateOk(req, key, perMinute, hourlyCeiling) {
  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  if (hour !== hourWindow) {
    hourWindow = hour;
    hourCount = 0;
  }
  hourCount += 1;
  if (hourCount > hourlyCeiling) return false;

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const id = key + ":" + ip;
  const cut = now - 60_000;
  const hits = (buckets.get(id) || []).filter((t) => t > cut);
  if (hits.length >= perMinute) {
    buckets.set(id, hits);
    return false;
  }
  hits.push(now);
  buckets.set(id, hits);
  if (buckets.size > 5000) buckets.clear();
  return true;
}
