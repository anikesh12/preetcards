require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const Database = require('better-sqlite3');

// ---------------------------------------------------------------------------
// Environment / paths
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_PHOTOS = parseInt(process.env.MAX_PHOTOS || '6', 10);
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 100;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');
const DB_PATH = path.join(DATA_DIR, 'cards.db');

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    recipient_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    thumb_filename TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
  );
`);

const insertCardStmt = db.prepare(
  'INSERT INTO cards (id, recipient_name, message, created_at) VALUES (?, ?, ?, ?)'
);
const insertPhotoStmt = db.prepare(
  'INSERT INTO photos (card_id, filename, thumb_filename, order_index) VALUES (?, ?, ?, ?)'
);
const getCardStmt = db.prepare('SELECT * FROM cards WHERE id = ?');
const getPhotosStmt = db.prepare(
  'SELECT * FROM photos WHERE card_id = ? ORDER BY order_index ASC'
);
const cardExistsStmt = db.prepare('SELECT 1 FROM cards WHERE id = ?');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSlug(length = 8) {
  const bytes = crypto.randomBytes(length);
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return slug;
}

function generateUniqueCardId() {
  let id;
  let attempts = 0;
  do {
    id = generateSlug(8);
    attempts++;
    if (attempts > 10) {
      throw new Error('Unable to generate a unique card ID');
    }
  } while (cardExistsStmt.get(id));
  return id;
}

function toPublicCard(cardRow, photoRows) {
  return {
    id: cardRow.id,
    recipientName: cardRow.recipient_name,
    message: cardRow.message,
    createdAt: cardRow.created_at,
    photos: photoRows.map((p) => ({
      url: `/uploads/${cardRow.id}/${p.filename}`,
      thumbUrl: `/uploads/${cardRow.id}/${p.thumb_filename}`,
    })),
  };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------------------------------------------------------------------------
// Multer (in-memory) config
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_PHOTOS,
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
    }
  },
});

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  cors({
    origin: CORS_ORIGIN,
  })
);

// Serve processed images
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    maxAge: '30d',
    immutable: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV });
});

apiRouter.post(
  '/cards',
  (req, res, next) => {
    upload.array('photos', MAX_PHOTOS)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: `Each photo must be smaller than ${MAX_FILE_SIZE_MB}MB.`,
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res
            .status(400)
            .json({ error: `You can upload up to ${MAX_PHOTOS} photos.` });
        }
        if (err.message === 'UNSUPPORTED_FILE_TYPE') {
          return res
            .status(400)
            .json({ error: 'Only JPEG, PNG, WEBP, or GIF images are allowed.' });
        }
        return next(err);
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const recipientName = (req.body.recipientName || '').trim();
    const message = (req.body.message || '').trim();
    const files = req.files || [];

    const errors = {};
    if (!recipientName) {
      errors.recipientName = 'Recipient name is required.';
    } else if (recipientName.length > MAX_NAME_LENGTH) {
      errors.recipientName = `Recipient name must be under ${MAX_NAME_LENGTH} characters.`;
    }

    if (!message) {
      errors.message = 'Birthday message is required.';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      errors.message = `Message must be under ${MAX_MESSAGE_LENGTH} characters.`;
    }

    if (files.length > MAX_PHOTOS) {
      errors.photos = `You can upload up to ${MAX_PHOTOS} photos.`;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fields: errors });
    }

    const cardId = generateUniqueCardId();
    const cardDir = path.join(UPLOADS_DIR, cardId);
    fs.mkdirSync(cardDir, { recursive: true });

    const processedPhotos = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const baseName = `photo-${i + 1}-${Date.now()}`;
        const filename = `${baseName}.webp`;
        const thumbFilename = `${baseName}-thumb.webp`;

        await sharp(file.buffer)
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(path.join(cardDir, filename));

        await sharp(file.buffer)
          .rotate()
          .resize({ width: 400, height: 400, fit: 'cover' })
          .webp({ quality: 75 })
          .toFile(path.join(cardDir, thumbFilename));

        processedPhotos.push({ filename, thumbFilename, orderIndex: i });
      }
    } catch (err) {
      fs.rmSync(cardDir, { recursive: true, force: true });
      throw err;
    }

    const createdAt = new Date().toISOString();

    const insertAll = db.transaction(() => {
      insertCardStmt.run(cardId, recipientName, message, createdAt);
      for (const p of processedPhotos) {
        insertPhotoStmt.run(cardId, p.filename, p.thumbFilename, p.orderIndex);
      }
    });
    insertAll();

    const cardRow = getCardStmt.get(cardId);
    const photoRows = getPhotosStmt.all(cardId);

    res.status(201).json(toPublicCard(cardRow, photoRows));
  })
);

apiRouter.get(
  '/cards/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const cardRow = getCardStmt.get(id);

    if (!cardRow) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const photoRows = getPhotosStmt.all(id);
    res.json(toPublicCard(cardRow, photoRows));
  })
);

app.use('/api', apiRouter);

// ---------------------------------------------------------------------------
// Serve built frontend (production) — SPA fallback
// ---------------------------------------------------------------------------
if (fs.existsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR, { maxAge: '1d' }));

  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message:
        'Birthday Wishes Card API is running. Frontend build not found — run the frontend build step to serve the SPA from this server.',
    });
  });
}

// ---------------------------------------------------------------------------
// 404 handler for unmatched API routes
// ---------------------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Birthday Wishes Card server listening on port ${PORT} [${NODE_ENV}]`);
});

module.exports = app;