const crypto = require('crypto');

// -----------------------------------------------------------------------------
// Admin auth middleware
//
// Gates admin-only routes using a single shared credential stored in the
// ADMIN_PASSWORD environment variable. Supports two auth flows:
//
//   1. Session/cookie based — a login form POSTs a password, this module
//      verifies it and issues a signed, httpOnly session cookie. Subsequent
//      requests are authenticated by validating that cookie.
//   2. HTTP Basic Auth fallback — useful for scripts/tools or browsers
//      hitting admin routes directly without going through the login form.
//
// No external session store or cookie-parsing dependency is required; cookies
// are parsed/signed manually using Node's built-in crypto module.
// -----------------------------------------------------------------------------

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS) || 12 * 60 * 60 * 1000; // 12h default

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      'ADMIN_PASSWORD (and optionally SESSION_SECRET) must be set to use admin auth middleware.'
    );
  }
  return secret;
}

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD environment variable is not set.');
  }
  return password;
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison to keep timing roughly consistent.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function sign(value) {
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(value);
  return hmac.digest('hex');
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (!key) return;
    try {
      cookies[key] = decodeURIComponent(val);
    } catch (_err) {
      cookies[key] = val;
    }
  });
  return cookies;
}

function buildSessionToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function isValidSessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  let expectedSignature;
  try {
    expectedSignature = sign(payload);
  } catch (_err) {
    return false;
  }

  if (!timingSafeStringEqual(signature, expectedSignature)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  return true;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAgeMs !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAgeMs / 1000)}`);
  }
  parts.push('Path=/');
  parts.push('HttpOnly');
  parts.push('SameSite=Strict');
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  if (options.expire) {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  return parts.join('; ');
}

/**
 * Verifies a plaintext password against ADMIN_PASSWORD using a
 * timing-safe comparison.
 */
function verifyPassword(password) {
  if (typeof password !== 'string' || password.length === 0) return false;
  let expected;
  try {
    expected = getAdminPassword();
  } catch (_err) {
    return false;
  }
  return timingSafeStringEqual(password, expected);
}

/**
 * Issues a signed admin session cookie on the response. Call after
 * verifying credentials submitted via the login form.
 */
function createAdminSession(res) {
  const token = buildSessionToken();
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, { maxAgeMs: SESSION_TTL_MS }));
}

/**
 * Clears the admin session cookie (logout).
 */
function clearAdminSession(res) {
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { expire: true }));
}

function parseBasicAuthHeader(header) {
  if (!header || !header.startsWith('Basic ')) return null;
  const base64Credentials = header.slice('Basic '.length).trim();
  let decoded;
  try {
    decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
  } catch (_err) {
    return null;
  }
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return null;
  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function wantsHtml(req) {
  const accept = req.headers && req.headers.accept;
  return typeof accept === 'string' && accept.includes('text/html');
}

function rejectRequest(req, res) {
  if (wantsHtml(req) && req.method === 'GET') {
    res.redirect(302, '/admin/login');
    return;
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
  res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Express middleware that gates admin routes.
 *
 * Accepts either:
 *   - A valid signed admin session cookie, or
 *   - HTTP Basic Auth credentials whose password matches ADMIN_PASSWORD.
 *
 * On success, calls next(). On failure, redirects browsers to /admin/login
 * or responds 401 for non-HTML/API requests.
 */
function adminAuth(req, res, next) {
  let adminPassword;
  try {
    adminPassword = getAdminPassword();
  } catch (err) {
    // Misconfigured server — fail closed, but surface a clear server error.
    res.status(500).json({ error: 'Admin auth is not configured on this server.' });
    return;
  }

  const cookies = parseCookies(req);
  const sessionToken = cookies[COOKIE_NAME];
  if (isValidSessionToken(sessionToken)) {
    next();
    return;
  }

  const basicAuthHeader = req.headers && req.headers.authorization;
  const credentials = parseBasicAuthHeader(basicAuthHeader);
  if (credentials && timingSafeStringEqual(credentials.password, adminPassword)) {
    // Grant access for this request and issue a session cookie so
    // subsequent requests don't need to keep sending Basic Auth.
    createAdminSession(res);
    next();
    return;
  }

  rejectRequest(req, res);
}

module.exports = adminAuth;
module.exports.adminAuth = adminAuth;
module.exports.verifyPassword = verifyPassword;
module.exports.createAdminSession = createAdminSession;
module.exports.clearAdminSession = clearAdminSession;
module.exports.COOKIE_NAME = COOKIE_NAME;