const rateLimitStore = {};
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

function rateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const now = Date.now();
    const entry = rateLimitStore[ip];

    if (!entry || now > entry.resetAt) {
        rateLimitStore[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
        return next();
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ status: 'error', message: 'Too many attempts. Please wait 15 minutes.' });
    }
    next();
}

module.exports = rateLimit;