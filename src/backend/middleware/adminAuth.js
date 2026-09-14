const crypto = require('crypto');

/**
 * adminAuth middleware
 *
 * Protects /api/admin/* routes using either:
 *  1. HTTP Basic Auth (any username, password must match ADMIN_PASSWORD), or
 *  2. A shared-secret header: `x-admin-secret: <ADMIN_PASSWORD>`
 *
 * On missing/invalid credentials, responds 401 with a WWW-Authenticate
 * challenge so browsers will prompt for Basic Auth credentials.
 *
 * Requires the ADMIN_PASSWORD environment variable to be set. If it is not
 * set, all requests are rejected (fail closed) with a 500 error, since no
 * valid credentials could ever be supplied.
 */

function timingSafeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));

  // Buffers must be the same length for timingSafeEqual; pad to avoid
  // leaking length information via early return.
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);

  const isSameLength = bufA.length === bufB.length;
  const isEqual = crypto.timingSafeEqual(paddedA, paddedB);

  return isSameLength && isEqual;
}

function sendUnauthorized(res, message) {
  res.set('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
  return res.status(401).json({ error: message || 'Unauthorized' });
}

function adminAuth(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error(
      'ADMIN_AUTH: ADMIN_PASSWORD environment variable is not set. Denying all admin requests.'
    );
    return res.status(500).json({ error: 'Admin authentication is not configured' });
  }

  // Option 1: pre-authenticated session (if session middleware is used upstream)
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  // Option 2: shared-secret header
  const sharedSecret = req.get('x-admin-secret');
  if (sharedSecret && timingSafeCompare(sharedSecret, adminPassword)) {
    return next();
  }

  // Option 3: HTTP Basic Auth
  const authHeader = req.get('authorization') || '';
  const [scheme, encodedCredentials] = authHeader.split(' ');

  if (scheme && scheme.toLowerCase() === 'basic' && encodedCredentials) {
    let decoded;
    try {
      decoded = Buffer.from(encodedCredentials, 'base64').toString('utf8');
    } catch (err) {
      return sendUnauthorized(res, 'Invalid Authorization header');
    }

    const separatorIndex = decoded.indexOf(':');
    const password = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);

    if (timingSafeCompare(password, adminPassword)) {
      if (req.session) {
        req.session.isAdmin = true;
      }
      return next();
    }
  }

  return sendUnauthorized(res, 'Missing or invalid admin credentials');
}

module.exports = adminAuth;