const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const LOGIN_REDIRECT_PATH = process.env.ADMIN_LOGIN_PATH || '/admin/login';

// --- Brute-force protection (per-IP, in-memory) ---
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BASE_LOCKOUT_MS = 30 * 1000; // 30 seconds, doubles for each additional failure past the threshold

const attemptStore = new Map(); // ip -> { count, firstAttempt, lockedUntil }

function getClientIp(req) {
  return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
}

function cleanupAttemptStore() {
  const now = Date.now();
  for (const [ip, rec] of attemptStore.entries()) {
    const expired = now - rec.firstAttempt > ATTEMPT_WINDOW_MS;
    const lockoutOver = !rec.lockedUntil || rec.lockedUntil < now;
    if (expired && lockoutOver) {
      attemptStore.delete(ip);
    }
  }
}
setInterval(cleanupAttemptStore, 5 * 60 * 1000).unref();

function isLocked(ip) {
  const rec = attemptStore.get(ip);
  return !!(rec && rec.lockedUntil && rec.lockedUntil > Date.now());
}

function getLockRemainingMs(ip) {
  const rec = attemptStore.get(ip);
  if (!rec || !rec.lockedUntil) return 0;
  return Math.max(0, rec.lockedUntil - Date.now());
}

function recordFailure(ip) {
  const now = Date.now();
  let rec = attemptStore.get(ip);
  if (!rec || now - rec.firstAttempt > ATTEMPT_WINDOW_MS) {
    rec = { count: 0, firstAttempt: now, lockedUntil: 0 };
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
    const backoffMultiplier = Math.pow(2, rec.count - MAX_ATTEMPTS_BEFORE_LOCKOUT);
    rec.lockedUntil = now + BASE_LOCKOUT_MS * backoffMultiplier;
    console.warn(
      `[adminAuth] IP ${ip} locked out after ${rec.count} failed admin auth attempts. ` +
      `Locked until ${new Date(rec.lockedUntil).toISOString()}.`
    );
  }
  attemptStore.set(ip, rec);
}

function recordSuccess(ip) {
  attemptStore.delete(ip);
}

// --- Constant-time comparisons ---
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) {
    // Compare against self to keep timing roughly constant, then fail.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// --- Config validation (fail closed) ---
function assertConfigured() {
  if (!ADMIN_PASSWORD) {
    throw new Error(
      '[adminAuth] ADMIN_PASSWORD env var is not set. Refusing to allow access to admin routes.'
    );
  }
  if (!SESSION_SECRET) {
    throw new Error(
      '[adminAuth] SESSION_SECRET env var is not set. It must be configured independently of ' +
      'ADMIN_PASSWORD (fail closed) — the app will not fall back to using the admin password as ' +
      'the session-signing secret.'
    );
  }
  if (safeEqual(SESSION_SECRET, ADMIN_PASSWORD)) {
    console.warn(
      '[adminAuth] WARNING: SESSION_SECRET is identical to ADMIN_PASSWORD. Use a distinct, ' +
      'independently generated secret for signing sessions.'
    );
  }
}

// --- Session token (signed, stateless) ---
function sign(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

function createSessionToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!safeEqual(signature, sign(payload))) return false;
  const expires = parseInt(payload, 10);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  return true;
}

// --- Cookie helpers (no external dependency required) ---
function parseCookies(req) {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies;
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch (err) {
      cookies[key] = val;
    }
  });
  return cookies;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`
  );
}

// --- Shared config-check response ---
function respondNotConfigured(res) {
  return res.status(500).json({ error: 'Admin auth is not configured correctly on the server.' });
}

function respondLocked(req, res) {
  const ip = getClientIp(req);
  const remainingMs = getLockRemainingMs(ip);
  res.setHeader('Retry-After', String(Math.ceil(remainingMs / 1000)));
  return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
}

function wantsHtml(req) {
  return req.accepts(['html', 'json']) === 'html';
}

function respondUnauthorized(req, res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
  if (wantsHtml(req)) {
    return res.redirect(302, LOGIN_REDIRECT_PATH);
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * POST /admin/login handler.
 * Expects { password } in the request body (JSON or urlencoded).
 * On success, sets a signed session cookie.
 */
function login(req, res) {
  try {
    assertConfigured();
  } catch (err) {
    console.error(err.message);
    return respondNotConfigured(res);
  }

  const ip = getClientIp(req);

  if (isLocked(ip)) {
    return respondLocked(req, res);
  }

  const password = req.body && req.body.password;

  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid password.' });
  }

  recordSuccess(ip);
  setSessionCookie(res, createSessionToken());
  return res.status(200).json({ ok: true });
}

/**
 * POST /admin/logout handler. Clears the session cookie.
 */
function logout(req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

/**
 * Express middleware gating admin routes.
 * Accepts either:
 *  - a valid signed session cookie (issued via POST /admin/login), or
 *  - HTTP Basic Auth with the shared ADMIN_PASSWORD (any username).
 * Applies per-IP rate limiting with exponential backoff lockout to
 * throttle brute-force attempts against the shared password.
 */
function adminAuth(req, res, next) {
  try {
    assertConfigured();
  } catch (err) {
    console.error(err.message);
    return respondNotConfigured(res);
  }

  const ip = getClientIp(req);

  if (isLocked(ip)) {
    return respondLocked(req, res);
  }

  // 1. Session cookie
  const cookies = parseCookies(req);
  const sessionToken = cookies[COOKIE_NAME];
  if (sessionToken && verifySessionToken(sessionToken)) {
    return next();
  }

  // 2. HTTP Basic Auth fallback
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.slice('Basic '.length).trim();
    let decoded = '';
    try {
      decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
    } catch (err) {
      decoded = '';
    }
    const separatorIdx = decoded.indexOf(':');
    const password = separatorIdx === -1 ? decoded : decoded.slice(separatorIdx + 1);

    if (password && safeEqual(password, ADMIN_PASSWORD)) {
      recordSuccess(ip);
      // Issue a session cookie so subsequent requests don't need to resend Basic Auth.
      setSessionCookie(res, createSessionToken());
      return next();
    }

    recordFailure(ip);
    return respondUnauthorized(req, res);
  }

  // No credentials supplied at all: reject without counting it as a brute-force
  // attempt (this is the normal first-visit path, not a guessed password).
  return respondUnauthorized(req, res);
}

module.exports = {
  adminAuth,
  login,
  logout,
};