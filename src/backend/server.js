const path = require('path');
const fs = require('fs');
const express = require('express');
require('./db');
const cardsRouter = require('./routes/cards');
const { handleUploadErrors } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3001;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

// ---- API Routes ----

app.use('/api/cards', cardsRouter, handleUploadErrors);

// ---- Serve frontend (production build) ----

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ---- Error handling ----

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Resource not found.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;