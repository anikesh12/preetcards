const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// ---- Config ----
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAX_PHOTOS = 6;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per file
const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const DEFAULT_TEMPLATE = 'default';
const TEMPLATE_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;
const ALLOWED_TEMPLATES = new Set([
  'default',
  'Customized-card',
  'classic',
  'confetti',
]);

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---- Ensure schema supports a `template` column (self-healing migration) ----
try {
  const columns = db.prepare('PRAGMA table_info(cards)').all();
  const hasTemplate = columns.some((col) => col.name === 'template');
  if (!hasTemplate) {
    db.prepare(
      `ALTER TABLE cards ADD COLUMN template TEXT NOT NULL DEFAULT '${DEFAULT_TEMPLATE}'`
    ).run();
  }
} catch (err) {
  // If the cards table doesn't exist yet, create it with the template column included.
  db.prepare(
    `CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      recipient_name TEXT NOT NULL,
      message TEXT NOT NULL,
      template TEXT NOT NULL DEFAULT '${DEFAULT_TEMPLATE}',
      photos TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
}

// ---- Multer (in-memory, we process with sharp before writing to disk) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PHOTOS,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

// ---- Helpers ----
function generateId(length = 8) {
  return crypto
    .randomBytes(length)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, length);
}

function generateUniqueId() {
  let id;
  let exists = true;
  do {
    id = generateId(8);
    const row = db.prepare('SELECT id FROM cards WHERE id = ?').get(id);
    exists = !!row;
  } while (exists);
  return id;
}

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

// Validate/sanitize the requested template. Falls back to the default
// template if the value is missing, malformed, or not recognized.
function sanitizeTemplate(rawTemplate) {
  if (rawTemplate === undefined || rawTemplate === null) {
    return DEFAULT_TEMPLATE;
  }

  const value = String(rawTemplate).trim();

  if (!value) {
    return DEFAULT_TEMPLATE;
  }

  if (!TEMPLATE_REGEX.test(value)) {
    return DEFAULT_TEMPLATE;
  }

  if (!ALLOWED_TEMPLATES.has(value)) {
    return DEFAULT_TEMPLATE;
  }

  return value;
}

async function processAndSaveImage(fileBuffer, cardId, index) {
  const baseName = `${cardId}-${index}-${Date.now()}`;
  const fullFilename = `${baseName}.jpg`;
  const thumbFilename = `${baseName}-thumb.jpg`;

  const fullPath = path.join(UPLOADS_DIR, fullFilename);
  const thumbPath = path.join(UPLOADS_DIR, thumbFilename);

  await sharp(fileBuffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(fullPath);

  await sharp(fileBuffer)
    .rotate()
    .resize({ width: 400, height: 400, fit: 'cover' })
    .jpeg({ quality: 75 })
    .toFile(thumbPath);

  return {
    url: `/uploads/${fullFilename}`,
    thumbnailUrl: `/uploads/${thumbFilename}`,
  };
}

// ---- Routes ----

// POST /api/cards
router.post('/', upload.array('photos', MAX_PHOTOS), async (req, res) => {
  try {
    const recipientName = sanitizeText(req.body.recipientName);
    const message = sanitizeText(req.body.message);
    const template = sanitizeTemplate(req.body.template);

    const errors = {};

    if (!recipientName) {
      errors.recipientName = 'Recipient name is required.';
    } else if (recipientName.length > MAX_NAME_LENGTH) {
      errors.recipientName = `Recipient name must be ${MAX_NAME_LENGTH} characters or fewer.`;
    }

    if (!message) {
      errors.message = 'A birthday message is required.';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      errors.message = `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
    }

    const files = req.files || [];
    if (files.length > MAX_PHOTOS) {
      errors.photos = `You can upload up to ${MAX_PHOTOS} photos.`;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const cardId = generateUniqueId();

    const photos = [];
    for (let i = 0; i < files.length; i += 1) {
      try {
        const processed = await processAndSaveImage(files[i].buffer, cardId, i);
        photos.push(processed);
      } catch (imgErr) {
        return res.status(400).json({
          error: 'Image processing failed',
          details: { photos: 'One or more images could not be processed.' },
        });
      }
    }

    db.prepare(
      `INSERT INTO cards (id, recipient_name, message, template, photos)
       VALUES (?, ?, ?, ?, ?)`
    ).run(cardId, recipientName, message, template, JSON.stringify(photos));

    return res.status(201).json({
      id: cardId,
      recipientName,
      message,
      template,
      photos,
    });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('Only JPEG')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error creating card:', err);
    return res.status(500).json({ error: 'Failed to create card.' });
  }
});

// GET /api/cards/:id
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid card id.' });
    }

    const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);

    if (!row) {
      return res.status(404).json({ error: 'Card not found' });
    }

    let photos = [];
    try {
      photos = JSON.parse(row.photos || '[]');
    } catch (parseErr) {
      photos = [];
    }

    return res.json({
      id: row.id,
      recipientName: row.recipient_name,
      message: row.message,
      template: row.template || DEFAULT_TEMPLATE,
      photos,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Error fetching card:', err);
    return res.status(500).json({ error: 'Failed to fetch card.' });
  }
});

module.exports = router;