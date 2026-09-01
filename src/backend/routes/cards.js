const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PHOTOS,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/cards - create a new card
router.post('/', upload.array('photos', MAX_PHOTOS), async (req, res) => {
  try {
    const { recipientName, message } = req.body;

    if (!recipientName || !recipientName.trim()) {
      return res.status(400).json({ error: 'Recipient name is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 500) {
      return res.status(400).json({ error: 'Message must be 500 characters or fewer' });
    }

    const files = req.files || [];
    if (files.length > MAX_PHOTOS) {
      return res.status(400).json({ error: `You can upload at most ${MAX_PHOTOS} photos` });
    }

    const id = nanoid(8);
    const photoPaths = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = `${id}-${i}.jpg`;
      const outputPath = path.join(UPLOADS_DIR, filename);

      await sharp(file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);

      photoPaths.push(`/uploads/${filename}`);
    }

    const createdAt = new Date().toISOString();

    const stmt = db.prepare(
      `INSERT INTO cards (id, recipient_name, message, photo_paths, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(id, recipientName.trim(), message.trim(), JSON.stringify(photoPaths), createdAt);

    res.status(201).json({
      id,
      recipientName: recipientName.trim(),
      message: message.trim(),
      photoPaths,
      createdAt,
    });
  } catch (err) {
    console.error('Error creating card:', err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// GET /api/cards/:id - retrieve a card by id
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const row = db
      .prepare(
        `SELECT id, recipient_name, message, photo_paths, created_at
         FROM cards WHERE id = ?`
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ error: 'Card not found' });
    }

    let photoPaths = [];
    try {
      photoPaths = row.photo_paths ? JSON.parse(row.photo_paths) : [];
    } catch (parseErr) {
      photoPaths = [];
    }

    res.json({
      id: row.id,
      recipientName: row.recipient_name,
      message: row.message,
      photoPaths,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Error fetching card:', err);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

module.exports = router;