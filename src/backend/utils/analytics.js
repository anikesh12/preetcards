const db = require('../db');

const VALID_GRANULARITIES = ['day', 'week'];

/**
 * Normalizes and validates a granularity value.
 * @param {string} granularity
 * @returns {'day'|'week'}
 */
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
 * @param {string} column - column name or SQL expression holding a timestamp
 * @param {'day'|'week'} granularity
 * @returns {string} SQL expression
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
 * Builds a WHERE clause fragment (without leading AND) and param list
 * for filtering rows by an optional start/end date range on a column.
 * @param {string} column
 * @param {{ startDate?: string, endDate?: string }} range
 * @returns {{ clause: string, params: any[] }}
 */
function buildDateRangeClause(column, { startDate, endDate } = {}) {
  const clauses = [];
  const params = [];

  if (startDate) {
    clauses.push(`date(${column}) >= date(?)`);
    params.push(startDate);
  }
  if (endDate) {
    clauses.push(`date(${column}) <= date(?)`);
    params.push(endDate);
  }

  return {
    clause: clauses.length ? clauses.join(' AND ') : '',
    params,
  };
}

/**
 * Returns view statistics grouped into daily or weekly buckets, including
 * both total (overall) views and unique-device views per bucket.
 *
 * If cardId is provided, stats are scoped to that card only. If omitted,
 * stats are aggregated across all cards (useful for admin overview).
 *
 * @param {Object} [options]
 * @param {string} [options.cardId] - restrict stats to a single card
 * @param {'day'|'week'} [options.granularity='day']
 * @param {string} [options.startDate] - ISO date (inclusive)
 * @param {string} [options.endDate] - ISO date (inclusive)
 * @returns {Array<{ bucket: string, totalViews: number, uniqueViews: number }>}
 */
function getCardViewStats({ cardId, granularity = 'day', startDate, endDate } = {}) {
  const g = normalizeGranularity(granularity);
  const bucketExpr = buildBucketExpr('created_at', g);

  const whereParts = [`event_type = 'view'`];
  const params = [];

  if (cardId) {
    whereParts.push('card_id = ?');
    params.push(cardId);
  }

  const { clause: dateClause, params: dateParams } = buildDateRangeClause('created_at', { startDate, endDate });
  if (dateClause) {
    whereParts.push(dateClause);
    params.push(...dateParams);
  }

  const sql = `
    SELECT
      ${bucketExpr} AS bucket,
      COUNT(*) AS totalViews,
      COUNT(DISTINCT device_id) AS uniqueViews
    FROM events
    WHERE ${whereParts.join(' AND ')}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  const rows = db.prepare(sql).all(...params);

  return rows.map((row) => ({
    bucket: row.bucket,
    totalViews: row.totalViews,
    uniqueViews: row.uniqueViews,
  }));
}

/**
 * Returns per-card view statistics for a single card, an alias of
 * getCardViewStats scoped to one card. Kept for readability/backwards
 * compatibility at call sites that always operate on a single card.
 *
 * @param {string} cardId
 * @param {Object} [options]
 * @param {'day'|'week'} [options.granularity='day']
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @returns {Array<{ bucket: string, totalViews: number, uniqueViews: number }>}
 */
function getCardViewStatsForCard(cardId, options = {}) {
  if (!cardId) {
    throw new Error('cardId is required');
  }
  return getCardViewStats({ ...options, cardId });
}

/**
 * Returns the total and unique-device view counts for a single card,
 * collapsed across the whole time range (no bucketing).
 *
 * @param {string} cardId
 * @param {Object} [options]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @returns {{ totalViews: number, uniqueViews: number }}
 */
function getCardViewSummary(cardId, { startDate, endDate } = {}) {
  if (!cardId) {
    throw new Error('cardId is required');
  }

  const whereParts = [`event_type = 'view'`, 'card_id = ?'];
  const params = [cardId];

  const { clause: dateClause, params: dateParams } = buildDateRangeClause('created_at', { startDate, endDate });
  if (dateClause) {
    whereParts.push(dateClause);
    params.push(...dateParams);
  }

  const sql = `
    SELECT
      COUNT(*) AS totalViews,
      COUNT(DISTINCT device_id) AS uniqueViews
    FROM events
    WHERE ${whereParts.join(' AND ')}
  `;

  const row = db.prepare(sql).get(...params);

  return {
    totalViews: row?.totalViews || 0,
    uniqueViews: row?.uniqueViews || 0,
  };
}

/**
 * Returns the number of cards created per day or week bucket.
 *
 * @param {Object} [options]
 * @param {'day'|'week'} [options.granularity='day']
 * @param {string} [options.startDate] - ISO date (inclusive)
 * @param {string} [options.endDate] - ISO date (inclusive)
 * @returns {Array<{ bucket: string, cardsCreated: number }>}
 */
function getCardCreationStats({ granularity = 'day', startDate, endDate } = {}) {
  const g = normalizeGranularity(granularity);
  const bucketExpr = buildBucketExpr('created_at', g);

  const whereParts = [];
  const params = [];

  const { clause: dateClause, params: dateParams } = buildDateRangeClause('created_at', { startDate, endDate });
  if (dateClause) {
    whereParts.push(dateClause);
    params.push(...dateParams);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const sql = `
    SELECT
      ${bucketExpr} AS bucket,
      COUNT(*) AS cardsCreated
    FROM cards
    ${whereSql}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  const rows = db.prepare(sql).all(...params);

  return rows.map((row) => ({
    bucket: row.bucket,
    cardsCreated: row.cardsCreated,
  }));
}

module.exports = {
  getCardViewStats,
  getCardViewStatsForCard,
  getCardViewSummary,
  getCardCreationStats,
};