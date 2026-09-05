const express = require('express');
const { nanoid } = require('nanoid');
const { db } = require('../db');
const { upload, verifyImageContents, cleanupFiles, MAX_FILES: MAX_PHOTOS } = require('../middleware/upload');
const { processImages, toPhotoPathsJson, fromPhotoPathsJson } = require('../utils/imageProcessing');

const router = express.Router();

const COLLAGE_LAYOUTS = ['grid', 'spotlight', 'filmstrip', 'scatter'];
const DEFAULT_COLLAGE_LAYOUT = 'grid';

// POST /api/cards - create a new card
router.post('/', upload.array('photos', MAX_PHOTOS), verifyImageContents, async (req, res, next) => {
  const files = req.files || [];

  try {
    const { recipientName, message } = req.body;
    const collageLayout = COLLAGE_LAYOUTS.includes(req.body.collageLayout)
      ? req.body.collageLayout
      : DEFAULT_COLLAGE_LAYOUT;

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
      `INSERT INTO cards (slug, recipient_name, message, photo_paths, collage_layout, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, recipientName.trim(), message.trim(), toPhotoPathsJson(photoPaths), collageLayout, createdAt);

    res.status(201).json({
      id,
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
        `SELECT slug, recipient_name, message, photo_paths, collage_layout, created_at
         FROM cards WHERE slug = ?`
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const photoPaths = fromPhotoPathsJson(row.photo_paths);

    res.json({
      id: row.slug,
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

module.exports = router;