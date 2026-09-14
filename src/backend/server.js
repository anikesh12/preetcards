require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const cardsRouter = require('./routes/cards');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---- Core body/cookie parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-cookie-secret'));

// ---- Session middleware (needed for admin auth) ----
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  session({
    name: 'bwc.sid',
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ---- Static assets ----
app.use('/uploads', express.static(UPLOADS_DIR));

// ---- API routes ----
app.use('/api/cards', cardsRouter);
app.use('/api/admin', adminRouter);

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---- Serve frontend build ----
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback: serve index.html for any non-API route
  // (covers card view routes, /admin, and any other client-side routes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  console.warn(
    'Frontend build not found at',
    FRONTEND_DIST,
    '- run `npm run build` in /frontend before starting in production.'
  );
}

// ---- 404 handler for unmatched API routes ----
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;