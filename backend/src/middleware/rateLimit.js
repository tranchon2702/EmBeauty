// Minimal fixed-window limiter kept in process memory. The API runs as a single
// PM2 fork process, so a shared store (Redis) would be overkill — but note that
// switching PM2 to cluster mode would give each worker its own counters.
const buckets = new Map();

// Drop expired buckets periodically so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * @param {object}   opts
 * @param {number}   opts.windowMs  Window length in milliseconds.
 * @param {number}   opts.max       Allowed requests per key per window.
 * @param {function} [opts.keyFn]   Derives the bucket key from the request.
 * @param {string}   [opts.message] Vietnamese message shown to the user.
 */
export const rateLimit = ({ windowMs, max, keyFn, message }) => (req, res, next) => {
  const key = keyFn ? keyFn(req) : req.ip;
  if (!key) return next();

  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      code: 'RATE_LIMITED',
      retryAfter,
      message: message || `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`,
    });
  }

  return next();
};

/** Called after a successful login so a valid PIN resets the failure counter. */
export const clearRateLimit = (key) => buckets.delete(key);
