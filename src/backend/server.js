require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const cardsRouter = require('./routes/cards');
const adminRouter = require('./routes/admin');
const { ensureDeviceId } = require('./utils/analytics');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Admin session signing (ADMIN_PASSWORD/SESSION_SECRET) is validated with a
// fail-closed check inside routes/admin.js itself -- no need to duplicate
// that check here.

// --- Core middleware -----------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(ensureDeviceId);

// --- Static assets ---------------------------------------------------------
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- API routes -------------------------------------------------------------
app.use('/api/cards', cardsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Frontend (SPA) -----------------------------------------------------
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));

  // SPA fallback: serve index.html for any non-API, non-uploads route
  // (covers client-side routes such as /admin, /:cardId, etc.)
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/uploads/')
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });
} else {
  console.warn(
    `Frontend build not found at ${frontendDistDir}. Run the frontend ` +
      'build before starting the server in production.'
  );
}

// --- Error handling -----------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: isProduction ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (${NODE_ENV})`);
});

module.exports = app;