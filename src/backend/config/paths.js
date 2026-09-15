const path = require('path');

// Single source of truth for where persistent data lives on disk.
// Defaults keep local development working with zero setup (everything
// under backend/). In production, set UPLOADS_DIR and DATABASE_PATH to
// point inside a mounted persistent disk (e.g. Render Persistent Disk),
// otherwise card photos and the database are wiped on every deploy.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const DATABASE_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '..', 'data', 'cards.db');

module.exports = {
  UPLOADS_DIR,
  DATABASE_PATH,
};
