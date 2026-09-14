const crypto = require('crypto');
const geoip = require('geoip-lite');
const { UAParser } = require('ua-parser-js');
const { db } = require('../db');

const DEVICE_COOKIE = 'bwc_device_id';
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

/**
 * Assigns every visitor a random, non-identifying device ID in a first-party
 * cookie (set once, reused on return visits) so repeat traffic from the same
 * browser can be recognized for view-counting and abuse detection -- without
 * ever knowing who the visitor actually is.
 */
function ensureDeviceId(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let deviceId = cookies[DEVICE_COOKIE];
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    res.setHeader(
      'Set-Cookie',
      `${DEVICE_COOKIE}=${deviceId}; Max-Age=${DEVICE_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax`
    );
  }
  req.deviceId = deviceId;
  next();
}

/**
 * Logs one analytics event (a card view or a card creation). Never throws --
 * a logging failure should never break the actual request it's attached to.
 */
function logEvent(req, eventType, cardSlug = null) {
  try {
    const ip = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
    const geo = geoip.lookup(ip);
    const ua = new UAParser(req.headers['user-agent']).getResult();

    db.prepare(
      `INSERT INTO events
         (event_type, card_slug, device_id, ip_address, city, country, browser, os, device_type, referer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventType,
      cardSlug,
      req.deviceId || null,
      ip || null,
      geo?.city || null,
      geo?.country || null,
      ua.browser.name || null,
      ua.os.name || null,
      ua.device.type || 'desktop',
      req.headers.referer || null
    );
  } catch (err) {
    console.error('Failed to log analytics event:', err);
  }
}

/** Overall (every hit) and unique-device view counts for a single card. */
function getCardViewStats(cardSlug) {
  const overall = db
    .prepare(`SELECT COUNT(*) AS count FROM events WHERE event_type = 'view' AND card_slug = ?`)
    .get(cardSlug);
  const unique = db
    .prepare(`SELECT COUNT(DISTINCT device_id) AS count FROM events WHERE event_type = 'view' AND card_slug = ?`)
    .get(cardSlug);
  return { overallViews: overall.count, uniqueViews: unique.count };
}

const VALID_GRANULARITIES = ['day', 'week'];

function normalizeGranularity(granularity) {
  const g = (granularity || 'day').toLowerCase();
  if (!VALID_GRANULARITIES.includes(g)) {
    throw new Error(`Invalid granularity "${granularity}". Must be one of: ${VALID_GRANULARITIES.join(', ')}`);
  }
  return g;
}

/**
 * Builds a SQL expression that buckets a timestamp column into a day or
 * week bucket. Week buckets are aligned to Monday and represented by the
 * ISO date (YYYY-MM-DD) of that Monday, so buckets sort chronologically
 * as plain strings.
 */
function buildBucketExpr(column, granularity) {
  if (granularity === 'week') {
    // strftime('%w', col) => 0 (Sun) .. 6 (Sat). Days since Monday:
    // Mon=0, Tue=1, ... Sun=6  => (%w + 6) % 7
    return `date(${column}, '-' || ((strftime('%w', ${column}) + 6) % 7) || ' days')`;
  }
  return `date(${column})`;
}

/**
 * Site-wide view stats grouped into daily or weekly buckets (every card
 * combined) -- used by the admin dashboard's breakdown table.
 *
 * @param {Object} [options]
 * @param {'day'|'week'} [options.granularity='day']
 * @returns {Array<{ bucket: string, totalViews: number, uniqueViews: number }>}
 */
function getViewStatsBucketed({ granularity = 'day' } = {}) {
  const g = normalizeGranularity(granularity);
  const bucketExpr = buildBucketExpr('created_at', g);

  const sql = `
    SELECT
      ${bucketExpr} AS bucket,
      COUNT(*) AS totalViews,
      COUNT(DISTINCT device_id) AS uniqueViews
    FROM events
    WHERE event_type = 'view'
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return db.prepare(sql).all().map((row) => ({
    bucket: row.bucket,
    totalViews: row.totalViews,
    uniqueViews: row.uniqueViews,
  }));
}

/** Site-wide total and unique-device view counts, across every card. */
function getOverallViewSummary() {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS totalViews, COUNT(DISTINCT device_id) AS uniqueViews
       FROM events WHERE event_type = 'view'`
    )
    .get();
  return { totalViews: row?.totalViews || 0, uniqueViews: row?.uniqueViews || 0 };
}

/** Total number of cards ever created. */
function getTotalCardCount() {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM cards`).get();
  return row?.count || 0;
}

module.exports = {
  DEVICE_COOKIE,
  ensureDeviceId,
  logEvent,
  getCardViewStats,
  getViewStatsBucketed,
  getOverallViewSummary,
  getTotalCardCount,
};
