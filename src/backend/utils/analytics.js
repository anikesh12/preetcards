const db = require('../db');

/**
 * Analytics utilities built on top of the shared `events` table.
 *
 * Expected `events` table shape (already created elsewhere in the app):
 *   id          INTEGER PRIMARY KEY AUTOINCREMENT
 *   card_id     TEXT NOT NULL
 *   event_type  TEXT NOT NULL   -- e.g. 'card_created' | 'card_view'
 *   device_id   TEXT            -- anonymous per-device identifier (cookie/localStorage id)
 *   created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 *
 * All grouping/aggregation below reuses this single table — no new tables
 * are introduced.
 */

const EVENT_TYPE_CARD_CREATED = 'card_created';
const EVENT_TYPE_CARD_VIEW = 'card_view';

/**
 * Build an optional SQL fragment + params for filtering on created_at
 * between startDate/endDate (inclusive), both ISO date/datetime strings.
 */
function buildDateRangeClause(startDate, endDate) {
  const clauses = [];
  const params = [];

  if (startDate) {
    clauses.push('created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    clauses.push('created_at <= ?');
    params.push(endDate);
  }

  return {
    sql: clauses.length ? `AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

/**
 * SQL expression that buckets a `created_at` timestamp into a period key.
 *   day  -> 'YYYY-MM-DD'
 *   week -> 'YYYY-MM-DD' of the Monday that starts that ISO-ish week
 */
function periodExpression(period) {
  if (period === 'week') {
    return `date(created_at, '-' || ((strftime('%w', created_at) + 6) % 7) || ' days')`;
  }
  // default: day
  return `date(created_at)`;
}

/**
 * Existing behavior: per-card total views, unique device count, and last
 * viewed timestamp. Reused/extended by the new grouped-stats functions
 * below rather than duplicating query logic.
 */
function getCardViewStats(cardId) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS totalViews,
         COUNT(DISTINCT device_id) AS uniqueDevices,
         MAX(created_at) AS lastViewedAt
       FROM events
       WHERE card_id = ?
         AND event_type = ?`
    )
    .get(cardId, EVENT_TYPE_CARD_VIEW);

  return {
    cardId,
    totalViews: row?.totalViews ?? 0,
    uniqueDevices: row?.uniqueDevices ?? 0,
    lastViewedAt: row?.lastViewedAt ?? null,
  };
}

/**
 * Generic: card-creation counts grouped by day or week.
 * Returns rows like { period: '2026-09-14', count: 3 }
 */
function getCardCreationCountsByPeriod(period = 'day', { startDate, endDate } = {}) {
  const bucket = periodExpression(period);
  const { sql: dateFilter, params: dateParams } = buildDateRangeClause(startDate, endDate);

  const rows = db
    .prepare(
      `SELECT
         ${bucket} AS period,
         COUNT(*) AS count
       FROM events
       WHERE event_type = ?
         ${dateFilter}
       GROUP BY period
       ORDER BY period ASC`
    )
    .all(EVENT_TYPE_CARD_CREATED, ...dateParams);

  return rows;
}

function getDailyCardCreationCounts(options = {}) {
  return getCardCreationCountsByPeriod('day', options);
}

function getWeeklyCardCreationCounts(options = {}) {
  return getCardCreationCountsByPeriod('week', options);
}

/**
 * Generic: card-view counts grouped by day or week, including both total
 * views and unique-device views per period.
 * Returns rows like:
 *   { period: '2026-09-14', totalViews: 12, uniqueDevices: 9 }
 */
function getViewCountsByPeriod(period = 'day', { startDate, endDate } = {}) {
  const bucket = periodExpression(period);
  const { sql: dateFilter, params: dateParams } = buildDateRangeClause(startDate, endDate);

  const rows = db
    .prepare(
      `SELECT
         ${bucket} AS period,
         COUNT(*) AS totalViews,
         COUNT(DISTINCT device_id) AS uniqueDevices
       FROM events
       WHERE event_type = ?
         ${dateFilter}
       GROUP BY period
       ORDER BY period ASC`
    )
    .all(EVENT_TYPE_CARD_VIEW, ...dateParams);

  return rows;
}

function getDailyViewCounts(options = {}) {
  return getViewCountsByPeriod('day', options);
}

function getWeeklyViewCounts(options = {}) {
  return getViewCountsByPeriod('week', options);
}

/**
 * Convenience: same total-vs-unique breakdown as getViewCountsByPeriod,
 * but scoped to a single card_id. Useful for per-card trend charts.
 */
function getCardViewCountsByPeriod(cardId, period = 'day', { startDate, endDate } = {}) {
  const bucket = periodExpression(period);
  const { sql: dateFilter, params: dateParams } = buildDateRangeClause(startDate, endDate);

  const rows = db
    .prepare(
      `SELECT
         ${bucket} AS period,
         COUNT(*) AS totalViews,
         COUNT(DISTINCT device_id) AS uniqueDevices
       FROM events
       WHERE event_type = ?
         AND card_id = ?
         ${dateFilter}
       GROUP BY period
       ORDER BY period ASC`
    )
    .all(EVENT_TYPE_CARD_VIEW, cardId, ...dateParams);

  return rows;
}

module.exports = {
  EVENT_TYPE_CARD_CREATED,
  EVENT_TYPE_CARD_VIEW,
  getCardViewStats,
  getCardCreationCountsByPeriod,
  getDailyCardCreationCounts,
  getWeeklyCardCreationCounts,
  getViewCountsByPeriod,
  getDailyViewCounts,
  getWeeklyViewCounts,
  getCardViewCountsByPeriod,
};