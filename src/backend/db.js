const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'cards.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    recipient_name TEXT NOT NULL,
    message TEXT NOT NULL,
    photos TEXT NOT NULL DEFAULT '[]',
    template TEXT NOT NULL DEFAULT 'standard',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migration safety: add 'template' column if the table already existed
// from a previous version of the schema without it.
const existingColumns = db.prepare(`PRAGMA table_info(cards)`).all();
const hasTemplateColumn = existingColumns.some((col) => col.name === 'template');

if (!hasTemplateColumn) {
  db.exec(`
    ALTER TABLE cards ADD COLUMN template TEXT NOT NULL DEFAULT 'standard'
  `);
}

function createCard({ id, recipientName, message, photos, template }) {
  const stmt = db.prepare(`
    INSERT INTO cards (id, recipient_name, message, photos, template)
    VALUES (@id, @recipientName, @message, @photos, @template)
  `);

  stmt.run({
    id,
    recipientName,
    message,
    photos: JSON.stringify(photos || []),
    template: template || 'standard',
  });

  return getCardById(id);
}

function getCardById(id) {
  const row = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    recipientName: row.recipient_name,
    message: row.message,
    photos: JSON.parse(row.photos || '[]'),
    template: row.template || 'standard',
    createdAt: row.created_at,
  };
}

module.exports = {
  db,
  createCard,
  getCardById,
};