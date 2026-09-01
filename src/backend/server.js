const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per file
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const IMAGE_MAX_WIDTH = 1600;
const THUMB_WIDTH = 500;

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PHOTOS,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error('INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

function generateId(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

function generateUniqueCardId() {
  const existsStmt = db.prepare('SELECT 1 FROM cards WHERE id = ?');
  let id = generateId();
  let attempts = 0;
  while (existsStmt.get(id) && attempts < 10) {
    id = generateId();
    attempts++;
  }
  return id;
}

app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

// ---- API Routes ----

app.post('/api/cards', upload.array('photos', MAX_PHOTOS), async (req, res) => {
  try {
    const recipientName = (req.body.recipientName || '').trim();
    const message = (req.body.message || '').trim();
    const files = req.files || [];

    const errors = {};
    if (!recipientName) {
      errors.recipientName = 'Recipient name is required.';
    } else if (recipientName.length > 100) {
      errors.recipientName = 'Recipient name is too long.';
    }

    if (!message) {
      errors.message = 'A birthday message is required.';
    } else if (message.length > 500) {
      errors.message = 'Message must be 500 characters or fewer.';
    }

    if (files.length > MAX_PHOTOS) {
      errors.photos = `You can upload up to ${MAX_PHOTOS} photos.`;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', fields: errors });
    }

    const cardId = generateUniqueCardId();
    const cardDir = path.join(UPLOADS_DIR, cardId);
    fs.mkdirSync(cardDir, { recursive: true });

    const insertCard = db.prepare(
      `INSERT INTO cards (id, recipient_name, message, created_at) VALUES (?, ?, ?, ?)`
    );
    const insertPhoto = db.prepare(
      `INSERT INTO photos (card_id, filename, thumbnail_filename, position) VALUES (?, ?, ?, ?)`
    );

    const createdAt = new Date().toISOString();
    insertCard.run(cardId, recipientName, message, createdAt);

    let position = 0;
    for (const file of files) {
      const baseName = `${crypto.randomBytes(6).toString('hex')}`;
      const fullFilename = `${baseName}.webp`;
      const thumbFilename = `${baseName}-thumb.webp`;

      await sharp(file.buffer)
        .rotate()
        .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(cardDir, fullFilename));

      await sharp(file.buffer)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(path.join(cardDir, thumbFilename));

      insertPhoto.run(cardId, fullFilename, thumbFilename, position);
      position++;
    }

    res.status(201).json({ id: cardId, url: `/card/${cardId}` });
  } catch (err) {
    console.error('Error creating card:', err);
    if (err.message === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, WEBP, and GIF images are allowed.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'Each photo must be under 8MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'TOO_MANY_FILES', message: `You can upload up to ${MAX_PHOTOS} photos.` });
    }
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong creating the card.' });
  }
});

app.get('/api/cards/:id', (req, res) => {
  try {
    const { id } = req.params;
    const card = db.prepare('SELECT id, recipient_name, message, created_at FROM cards WHERE id = ?').get(id);

    if (!card) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Card not found.' });
    }

    const photos = db
      .prepare('SELECT filename, thumbnail_filename FROM photos WHERE card_id = ? ORDER BY position ASC')
      .all(id)
      .map((photo) => ({
        url: `/uploads/${id}/${photo.filename}`,
        thumbnailUrl: `/uploads/${id}/${photo.thumbnail_filename}`,
      }));

    res.json({
      id: card.id,
      recipientName: card.recipient_name,
      message: card.message,
      createdAt: card.created_at,
      photos,
    });
  } catch (err) {
    console.error('Error fetching card:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong fetching the card.' });
  }
});

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