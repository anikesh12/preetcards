require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const cardsRouter = require('./routes/cards');
const adminRouter = require('./routes/admin');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Fail fast if ADMIN_PASSWORD is not set in production — the admin routes
// must never run with an undefined/blank password in a live environment.
if (NODE_ENV === 'production' && !ADMIN_PASSWORD) {
  console.error(
    '[FATAL] ADMIN_PASSWORD environment variable is not set. ' +
      'Refusing to start in production without an admin password. ' +
      'Set ADMIN_PASSWORD in your environment and restart the server.'
  );
  process.exit(1);
}

if (!ADMIN_PASSWORD) {
  console.warn(
    '[WARN] ADMIN_PASSWORD is not set. Admin routes will be inaccessible ' +
      'until this is configured. This is only acceptable outside production.'
  );
}

const app = express();

app.use(express.json());

// Uploaded images (served from disk)
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// API routes
app.use('/api/cards', cardsRouter);
app.use('/api/admin', adminRouter);

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve the built frontend (React SPA), including the /admin route which
// resolves client-side via react-router.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));

  // Any non-API GET request falls through to index.html so client-side
  // routes (e.g. /admin, /:cardId) resolve correctly.
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  console.warn(
    `[WARN] Frontend build not found at ${FRONTEND_DIST}. ` +
      'Run the frontend build before starting in production.'
  );
}

// Fallback 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (${NODE_ENV})`);
});

module.exports = app;