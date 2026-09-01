const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fssync.existsSync(UPLOADS_DIR)) {
  fssync.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Make sure the tables we need exist. Safe to run on every boot.
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    recipient_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS card_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    thumbnail_filename TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );
`);

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB per photo
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 500;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SLUG_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SLUG_LENGTH = 8;
const SLUG_PATTERN = /^[0-9a-zA-Z]{6,32}$/;

// ---------------------------------------------------------------------------
// Multer (in-memory; final files are written after sharp processing)
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_PHOTOS,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error('INVALID_FILE_TYPE');
      err.code = 'INVALID_FILE_TYPE';
      cb(err);
      return;
    }
    cb(null, true);
  },
});

function handlePhotoUpload(req, res, next) {
  upload.array('photos', MAX_PHOTOS)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `Each photo must be smaller than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: `You can upload a maximum of ${MAX_PHOTOS} photos.` });
      }
      return res.status(400).json({ error: 'There was a problem uploading your photos.' });
    }

    if (err.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: 'Photos must be JPEG, PNG, WEBP, or GIF images.' });
    }

    return res.status(400).json({ error: 'There was a problem uploading your photos.' });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Strip HTML tags / control characters and trim to a max length.
function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const withoutTags = value.replace(/<[^>]*>/g, '');
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = withoutTags.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return withoutControlChars.trim().slice(0, maxLength);
}

function generateSlug() {
  let slug = '';
  const bytes = crypto.randomBytes(SLUG_LENGTH);
  for (let i = 0; i < SLUG_LENGTH; i += 1) {
    slug += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return slug;
}

function generateUniqueSlug() {
  const existsStmt = db.prepare('SELECT 1 FROM cards WHERE id = ?');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = generateSlug();
    if (!existsStmt.get(slug)) return slug;
  }
  throw new Error('Could not generate a unique card ID. Please try again.');
}

function buildShareUrl(req, id) {
  const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${origin.replace(/\/$/, '')}/${id}`;
}

async function removeDirQuietly(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (_) {
    // Ignore cleanup errors — nothing more we can do here.
  }
}

async function processAndSaveImages(files, cardDir) {
  await fs.mkdir(cardDir, { recursive: true });

  const results = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const filename = `${i}.jpg`;
    const thumbFilename = `${i}-thumb.jpg`;

    await sharp(file.buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(cardDir, filename));

    await sharp(file.buffer)
      .rotate()
      .resize({ width: 400, height: 400, fit: 'cover' })
      .jpeg({ quality: 75, mozjpeg: true })
      .toFile(path.join(cardDir, thumbFilename));

    results.push({ filename, thumbFilename, position: i });
  }
  return results;
}

function toPublicImage(slug, image) {
  return {
    url: `/uploads/${slug}/${image.filename}`,
    thumbnailUrl: `/uploads/${slug}/${image.thumbFilename}`,
    position: image.position,
  };
}

// ---------------------------------------------------------------------------
// POST /api/cards — create a card + upload photos + return shareable URL
// ---------------------------------------------------------------------------

router.post(
  '/',
  handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const rawName = req.body && req.body.recipientName;
    const rawMessage = req.body && req.body.message;

    const recipientName = sanitizeText(rawName, MAX_NAME_LENGTH);
    const message = sanitizeText(rawMessage, MAX_MESSAGE_LENGTH);

    const errors = {};
    if (!recipientName) {
      errors.recipientName = 'Recipient name is required.';
    }
    if (!message) {
      errors.message = 'A birthday message is required.';
    }
    const files = req.files || [];
    if (files.length > MAX_PHOTOS) {
      errors.photos = `You can upload a maximum of ${MAX_PHOTOS} photos.`;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }

    let slug;
    try {
      slug = generateUniqueSlug();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    const cardDir = path.join(UPLOADS_DIR, slug);

    let savedImages = [];
    try {
      if (files.length > 0) {
        savedImages = await processAndSaveImages(files, cardDir);
      }

      const createdAt = new Date().toISOString();

      const insertCard = db.prepare(
        'INSERT INTO cards (id, recipient_name, message, created_at) VALUES (?, ?, ?, ?)'
      );
      const insertImage = db.prepare(
        'INSERT INTO card_images (card_id, filename, thumbnail_filename, position) VALUES (?, ?, ?, ?)'
      );

      const insertAll = db.transaction(() => {
        insertCard.run(slug, recipientName, message, createdAt);
        for (const img of savedImages) {
          insertImage.run(slug, img.filename, img.thumbFilename, img.position);
        }
      });
      insertAll();

      const shareUrl = buildShareUrl(req, slug);

      return res.status(201).json({
        id: slug,
        url: shareUrl,
        shareUrl,
        recipientName,
        message,
        images: savedImages.map((img) => toPublicImage(slug, img)),
        createdAt,
      });
    } catch (err) {
      await removeDirQuietly(cardDir);
      try {
        db.prepare('DELETE FROM card_images WHERE card_id = ?').run(slug);
        db.prepare('DELETE FROM cards WHERE id = ?').run(slug);
      } catch (_) {
        // best-effort cleanup
      }
      // eslint-disable-next-line no-console
      console.error('Failed to create card:', err);
      return res.status(500).json({ error: 'Something went wrong while creating your card. Please try again.' });
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/cards/:id — fetch a card + its images for the shareable page
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!SLUG_PATTERN.test(id)) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const images = db
      .prepare('SELECT filename, thumbnail_filename AS thumbFilename, position FROM card_images WHERE card_id = ? ORDER BY position ASC')
      .all(id);

    return res.json({
      id: card.id,
      recipientName: card.recipient_name,
      message: card.message,
      createdAt: card.created_at,
      images: images.map((img) => toPublicImage(id, img)),
    });
  })
);

module.exports = router;