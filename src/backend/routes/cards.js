const fs = require('fs');
const path = require('path');
const express = require('express');
const { nanoid } = require('nanoid');
const { db } = require('../db');
const { upload, verifyImageContents, cleanupFiles, MAX_FILES: MAX_PHOTOS } = require('../middleware/upload');
const {
  processImages, toPhotoPathsJson, fromPhotoPathsJson, getSafeCardUploadDir,
} = require('../utils/imageProcessing');
const { logEvent } = require('../utils/analytics');
const { watermarkImage } = require('../utils/watermark');

const router = express.Router();

const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.jpg$/;

const COLLAGE_LAYOUTS = ['grid', 'spotlight', 'filmstrip', 'scatter', 'customized-card'];
const DEFAULT_COLLAGE_LAYOUT = 'grid';

const OCCASIONS = [
  'birthday', 'anniversary', 'wedding', 'engagement', 'congratulations',
  'new_baby', 'get_well', 'farewell', 'retirement', 'thank_you',
];
const DEFAULT_OCCASION = 'birthday';

// POST /api/cards - create a new card
router.post('/', upload.array('photos', MAX_PHOTOS), verifyImageContents, async (req, res, next) => {
  const files = req.files || [];

  try {
    const { recipientName, message } = req.body;
    const collageLayout = COLLAGE_LAYOUTS.includes(req.body.collageLayout)
      ? req.body.collageLayout
      : DEFAULT_COLLAGE_LAYOUT;
    const occasion = OCCASIONS.includes(req.body.occasion)
      ? req.body.occasion
      : DEFAULT_OCCASION;

    if (!recipientName || !recipientName.trim()) {
      cleanupFiles(files);
      return res.status(400).json({ error: 'Recipient name is required' });
    }
    if (!message || !message.trim()) {
      cleanupFiles(files);
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 500) {
      cleanupFiles(files);
      return res.status(400).json({ error: 'Message must be 500 characters or fewer' });
    }

    const id = nanoid(8);
    const photoPaths = await processImages(id, files);
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO cards (slug, occasion, recipient_name, message, photo_paths, collage_layout, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, occasion, recipientName.trim(), message.trim(), toPhotoPathsJson(photoPaths), collageLayout, createdAt);
    logEvent(req, 'create', id);

    res.status(201).json({
      id,
      occasion,
      recipientName: recipientName.trim(),
      message: message.trim(),
      photoPaths,
      collageLayout,
      createdAt,
    });
  } catch (err) {
    cleanupFiles(files);
    console.error('Error creating card:', err);
    next(err);
  }
});

// GET /api/cards/:id - retrieve a card by its slug
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const row = db
      .prepare(
        `SELECT slug, occasion, recipient_name, message, photo_paths, collage_layout, created_at
         FROM cards WHERE slug = ?`
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const photoPaths = fromPhotoPathsJson(row.photo_paths);
    logEvent(req, 'view', id);

    res.json({
      id: row.slug,
      occasion: OCCASIONS.includes(row.occasion) ? row.occasion : DEFAULT_OCCASION,
      recipientName: row.recipient_name,
      message: row.message,
      photoPaths,
      photos: photoPaths.map((url, index) => ({ id: index, url, thumbnailUrl: url })),
      collageLayout: COLLAGE_LAYOUTS.includes(row.collage_layout) ? row.collage_layout : DEFAULT_COLLAGE_LAYOUT,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Error fetching card:', err);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// GET /api/cards/:id/download/:filename - watermarked photo download (free tier)
router.get('/:id/download/:filename', async (req, res) => {
  try {
    const { id, filename } = req.params;

    if (!SAFE_FILENAME_PATTERN.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const row = db.prepare('SELECT photo_paths FROM cards WHERE slug = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const photoPaths = fromPhotoPathsJson(row.photo_paths);
    const isKnownPhoto = photoPaths.includes(`/uploads/${id}/${filename}`);
    if (!isKnownPhoto) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    let cardUploadDir;
    try {
      cardUploadDir = getSafeCardUploadDir(id);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const filePath = path.join(cardUploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const buffer = await watermarkImage(filePath);
    res.set('Content-Type', 'image/jpeg');
    res.set('Content-Disposition', `attachment; filename="${id}-${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating watermarked download:', err);
    res.status(500).json({ error: 'Failed to generate download' });
  }
});

module.exports = router;