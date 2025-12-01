const limits = new Map();

function key(req, bucket) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  return `${bucket}:${ip}`;
}

function check(req, bucket = 'default', max = 20, windowMs = 60_000) {
  const k = key(req, bucket);
  const now = Date.now();
  const entry = limits.get(k) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count += 1;
  limits.set(k, entry);
  return entry.count <= max;
}

module.exports = { check };