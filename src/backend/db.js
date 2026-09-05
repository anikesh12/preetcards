const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// ---------------------------------------------------------------------------
// Canonical schema reference
//
// This is the single source of truth for the `cards` table structure.
// Other modules (routes, services) should import COLUMNS / TABLE from here
// rather than hardcoding column names, to avoid schema drift.
// ---------------------------------------------------------------------------
const TABLE = 'cards';

const COLUMNS = Object.freeze({
  ID: 'id',
  SLUG: 'slug',
  OCCASION: 'occasion', // birthday, anniversary, wedding, engagement, congratulations, new_baby, get_well, farewell, retirement, thank_you
  RECIPIENT_NAME: 'recipient_name',
  MESSAGE: 'message',
  PHOTO_PATHS: 'photo_paths', // JSON-encoded array of strings, stored as TEXT
  COLLAGE_LAYOUT: 'collage_layout', // one of: grid, spotlight, filmstrip, scatter
  CREATED_AT: 'created_at',
});

// Ordered list of columns, useful for building INSERT/SELECT statements.
const COLUMN_LIST = Object.freeze([
  COLUMNS.ID,
  COLUMNS.SLUG,
  COLUMNS.OCCASION,
  COLUMNS.RECIPIENT_NAME,
  COLUMNS.MESSAGE,
  COLUMNS.PHOTO_PATHS,
  COLUMNS.COLLAGE_LAYOUT,
  COLUMNS.CREATED_AT,
]);

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'cards.db');

// Ensure the data directory exists before opening the database file.
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---------------------------------------------------------------------------
// Canonical `cards` table.
//
// NOTE: This is the ONLY table definition for card data. Any previous
// competing `card_images` table (for storing per-photo rows) has been
// removed — photo paths are stored inline as a JSON-encoded array of
// strings in the `photo_paths` TEXT column instead.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    ${COLUMNS.ID} INTEGER PRIMARY KEY AUTOINCREMENT,
    ${COLUMNS.SLUG} TEXT NOT NULL UNIQUE,
    ${COLUMNS.OCCASION} TEXT NOT NULL DEFAULT 'birthday',
    ${COLUMNS.RECIPIENT_NAME} TEXT NOT NULL,
    ${COLUMNS.MESSAGE} TEXT NOT NULL,
    ${COLUMNS.PHOTO_PATHS} TEXT NOT NULL DEFAULT '[]',
    ${COLUMNS.COLLAGE_LAYOUT} TEXT NOT NULL DEFAULT 'grid',
    ${COLUMNS.CREATED_AT} TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_${TABLE}_slug ON ${TABLE} (${COLUMNS.SLUG});
`);

// Defensive cleanup: drop any legacy `card_images` table left over from an
// earlier schema design, since photo paths now live on the cards row itself.
db.exec(`DROP TABLE IF EXISTS card_images;`);

// ---------------------------------------------------------------------------
// `events` table -- internal analytics only, never exposed to end users.
// One row per meaningful request (a card being created, or a card being
// viewed). Used to compute per-card view counts and to spot abuse patterns
// (e.g. the same device/IP hitting the site repeatedly) before enabling ad
// placements. `device_id` is a random, non-identifying value stored in a
// first-party cookie -- it does not tie back to a real person.
// ---------------------------------------------------------------------------
const EVENTS_TABLE = 'events';

db.exec(`
  CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    card_slug TEXT,
    device_id TEXT NOT NULL,
    ip_address TEXT,
    city TEXT,
    country TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT,
    referer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_card_slug ON ${EVENTS_TABLE} (card_slug);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_device_id ON ${EVENTS_TABLE} (device_id);`);

module.exports = {
  db,
  TABLE,
  COLUMNS,
  COLUMN_LIST,
  DB_PATH,
  EVENTS_TABLE,
};