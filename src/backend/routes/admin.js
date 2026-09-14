const express = require('express');
const crypto = require('crypto');
const analytics = require('../utils/analytics');

const router = express.Router();

// --- Fail-closed configuration check -------------------------------------
// Admin auth is only as strong as these secrets. If either is missing we
// refuse to let this module load at all, rather than silently falling back
// to a hardcoded/guessable value. This will cause server startup to fail
// (loudly, in logs) until the operator sets real values.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
  throw new Error(
    'admin.js: ADMIN_PASSWORD environment variable is not set. Refusing to start.'
  );
}

if (!SESSION_SECRET || SESSION_SECRET.trim() === '') {
  throw new Error(
    'admin.js: SESSION_SECRET environment variable is not set. Refusing to start.'
  );
}

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Server-side session store --------------------------------------------
// Each login generates a fresh random session id. The cookie carries that
// id plus an HMAC signature (so it can't be forged/tampered with), but the
// id must ALSO exist in this server-side store and not be expired. This
// means:
//   - every login produces a distinct, unpredictable token
//   - sessions expire independently of the server secret
//   - a session can be individually revoked (e.g. on logout) without
//     invalidating every other session or requiring a secret rotation
const sessions = new Map(); // sessionId -> { expiresAt: number }

function createSession() {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(sessionId, { expiresAt });
  return { sessionId, expiresAt };
}

function revokeSession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

function isSessionValid(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(id);
  }
}

// Periodically sweep expired sessions so the store doesn't grow forever.
const cleanupInterval = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
if (typeof cleanupInterval.unref === 'function') cleanupInterval.unref();

function signSessionId(sessionId) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(sessionId)
    .digest('hex');
}

function buildCookieValue(sessionId) {
  const signature = signSessionId(sessionId);
  return `${sessionId}.${signature}`;
}

function parseCookieValue(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') return null;
  const separatorIndex = cookieValue.lastIndexOf('.');
  if (separatorIndex === -1) return null;

  const sessionId = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  if (!sessionId || !signature) return null;

  const expectedSignature = signSessionId(sessionId);

  const providedBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  return sessionId;
}

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) {
    // Still run a comparison of equal length to avoid leaking length via
    // early return timing, though this is a minor concern for passwords.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function setSessionCookie(res, sessionId, expiresAt) {
  const cookieValue = buildCookieValue(sessionId);
  res.cookie(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(expiresAt),
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

// --- Middleware -------------------------------------------------------------
function adminAuth(req, res, next) {
  const cookieValue = req.cookies && req.cookies[SESSION_COOKIE_NAME];
  const sessionId = parseCookieValue(cookieValue);

  if (!sessionId || !isSessionValid(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.adminSessionId = sessionId;
  next();
}

// --- Routes ------------------------------------------------------------------

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (!timingSafeStringEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const { sessionId, expiresAt } = createSession();
  setSessionCookie(res, sessionId, expiresAt);

  res.json({ success: true });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  const cookieValue = req.cookies && req.cookies[SESSION_COOKIE_NAME];
  const sessionId = parseCookieValue(cookieValue);

  revokeSession(sessionId);
  clearSessionCookie(res);

  res.json({ success: true });
});

// GET /api/admin/stats?range=daily|weekly
router.get('/stats', adminAuth, (req, res) => {
  try {
    const range = req.query.range === 'weekly' ? 'weekly' : 'daily';
    const granularity = range === 'weekly' ? 'week' : 'day';

    const totalCards = analytics.getTotalCardCount();
    const { totalViews, uniqueViews } = analytics.getOverallViewSummary();
    const bucketed = analytics.getViewStatsBucketed({ granularity });

    res.json({
      totalCards,
      totalViews,
      uniqueViews,
      breakdown: bucketed.map((row) => ({
        period: row.bucket,
        views: row.totalViews,
        uniqueViews: row.uniqueViews,
      })),
    });
  } catch (err) {
    console.error('Failed to load admin stats:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
module.exports.adminAuth = adminAuth;