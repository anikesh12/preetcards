const express = require('express');
const crypto = require('crypto');
const analytics = require('../analytics');

const router = express.Router();

const COOKIE_NAME = 'admin_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'birthday-card-admin-secret';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionToken() {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update('admin-authenticated')
    .digest('hex');
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) {
    // still run a comparison to keep timing consistent
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

function adminAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token && timingSafeStringEqual(token, getSessionToken())) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD is not configured on the server.');
    return res.status(500).json({ error: 'Admin login is not configured' });
  }

  if (!password || !timingSafeStringEqual(password, adminPassword)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.cookie(COOKIE_NAME, getSessionToken(), cookieOptions());
  return res.json({ success: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  return res.json({ success: true });
});

router.get('/stats', adminAuth, (req, res) => {
  try {
    const totalCards = analytics.getTotalCardsCreated();
    const overallViews = analytics.getTotalViews(); // { total, unique }
    const dailyViews = analytics.getViewsDaily(30); // [{ date, total, unique }]
    const weeklyViews = analytics.getViewsWeekly(12); // [{ weekStart, total, unique }]

    return res.json({
      totalCards,
      views: {
        overall: overallViews,
        daily: dailyViews,
        weekly: weeklyViews,
      },
    });
  } catch (err) {
    console.error('Failed to load admin stats:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
module.exports.adminAuth = adminAuth;