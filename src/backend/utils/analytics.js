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
      COUNT(CASE WHEN event_type = 'view' THEN 1 END) AS totalViews,
      COUNT(DISTINCT CASE WHEN event_type = 'view' THEN device_id END) AS uniqueViews,
      COUNT(CASE WHEN event_type = 'create' THEN 1 END) AS totalCreates
    FROM events
    WHERE event_type IN ('view', 'create')
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return db.prepare(sql).all().map((row) => ({
    bucket: row.bucket,
    totalViews: row.totalViews,
    uniqueViews: row.uniqueViews,
    totalCreates: row.totalCreates,
  }));
}

/**
 * Breakdown of events by device type (mobile/tablet/desktop) or OS
 * (Android/iOS/Windows/etc), for a given event type. Used by the admin
 * dashboard to answer "what are people actually using to view/create cards".
 * `field` is restricted to a fixed allowlist since it's a SQL identifier
 * (column names can't be parameterized).
 */
const BREAKDOWN_FIELDS = Object.freeze(['device_type', 'os', 'browser']);

function getEventFieldBreakdown(field, { eventType = 'view' } = {}) {
  if (!BREAKDOWN_FIELDS.includes(field)) {
    throw new Error(`getEventFieldBreakdown: invalid field "${field}"`);
  }

  const sql = `
    SELECT COALESCE(${field}, 'Unknown') AS label, COUNT(*) AS count
    FROM events
    WHERE event_type = ?
    GROUP BY label
    ORDER BY count DESC
  `;

  return db.prepare(sql).all(eventType);
}

/**
 * A page of cards (most recent first), each with its view count and the
 * device/OS of whoever created it (from that card's 'create' event) --
 * powers the admin dashboard's "Cards" list. Superseded the old unpaginated
 * getRecentCards(), which was capped at 100 and couldn't page further.
 */
function getCardsPage({ page = 1, limit = 20 } = {}) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * safeLimit;

  const total = db.prepare(`SELECT COUNT(*) AS count FROM cards`).get()?.count || 0;

  const sql = `
    SELECT
      c.slug,
      c.occasion,
      c.recipient_name AS recipientName,
      c.photo_paths AS photoPaths,
      c.created_at AS createdAt,
      (SELECT COUNT(*) FROM events e WHERE e.event_type = 'view' AND e.card_slug = c.slug) AS viewCount,
      (SELECT device_type FROM events e WHERE e.event_type = 'create' AND e.card_slug = c.slug ORDER BY e.created_at ASC LIMIT 1) AS creatorDeviceType,
      (SELECT os FROM events e WHERE e.event_type = 'create' AND e.card_slug = c.slug ORDER BY e.created_at ASC LIMIT 1) AS creatorOs
    FROM cards c
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const cards = db.prepare(sql).all(safeLimit, offset).map((row) => {
    let firstPhoto = null;
    try {
      const parsed = JSON.parse(row.photoPaths || '[]');
      firstPhoto = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
    } catch (err) {
      firstPhoto = null;
    }
    return {
      slug: row.slug,
      occasion: row.occasion,
      recipientName: row.recipientName,
      createdAt: row.createdAt,
      viewCount: row.viewCount,
      thumbnailUrl: firstPhoto,
      creatorDeviceType: row.creatorDeviceType || null,
      creatorOs: row.creatorOs || null,
    };
  });

  return {
    cards,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
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
  getEventFieldBreakdown,
  getCardsPage,
  getOverallViewSummary,
  getTotalCardCount,
};
