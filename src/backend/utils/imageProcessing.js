const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { UPLOADS_DIR } = require('../config/paths');

const CARD_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const MAX_PHOTOS = 6;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 80;

/**
 * Validate that a cardId is safe to use as a filesystem path segment.
 * Throws if the cardId is missing, not a string, or contains anything
 * other than alphanumerics, dashes, and underscores.
 */
function validateCardId(cardId) {
  if (typeof cardId !== 'string' || cardId.length === 0 || !CARD_ID_PATTERN.test(cardId)) {
    throw new Error('Invalid card ID');
  }
}

/**
 * Resolve the upload directory for a given cardId, guaranteeing (via both
 * an allowlist regex check and a resolved-path containment check) that the
 * result cannot escape UPLOADS_DIR, even if cardId somehow contained
 * traversal sequences.
 */
function getSafeCardUploadDir(cardId) {
  validateCardId(cardId);

  const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
  const candidateDir = path.resolve(resolvedUploadsDir, cardId);

  const relative = path.relative(resolvedUploadsDir, candidateDir);
  const isInside =
    relative === cardId &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative);

  if (!isInside) {
    throw new Error('Invalid card ID: path traversal detected');
  }

  return candidateDir;
}

/**
 * Ensure the per-card upload directory exists on disk and return its path.
 */
async function ensureCardUploadDir(cardId) {
  const cardUploadDir = getSafeCardUploadDir(cardId);
  await fsPromises.mkdir(cardUploadDir, { recursive: true });
  return cardUploadDir;
}

/**
 * Process an array of uploaded image files (as provided by multer, either
 * in-memory `buffer` or on-disk `path`) for a given card: resize/optimize
 * each with sharp and save into the card's upload directory.
 *
 * Returns a plain array of web-accessible relative paths (strings), in the
 * exact shape expected by the canonical `photo_paths` JSON column on the
 * cards table — i.e. NOT an array of row objects such as would be used for
 * a separate `card_images` table.
 *
 * Example return value:
 *   ["/uploads/abc123/1699999999-0-a1b2c3d4.jpg", "/uploads/abc123/....jpg"]
 */
async function processImages(cardId, files) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  if (files.length > MAX_PHOTOS) {
    throw new Error(`A maximum of ${MAX_PHOTOS} photos is allowed`);
  }

  const cardUploadDir = await ensureCardUploadDir(cardId);
  const photoPaths = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const input = file.buffer || file.path;

    if (!input) {
      throw new Error('Uploaded file has no readable data');
    }

    const filename = `${Date.now()}-${i}-${crypto.randomBytes(4).toString('hex')}.jpg`;
    const outputPath = path.join(cardUploadDir, filename);

    await sharp(input)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(outputPath);

    if (file.path) {
      await fsPromises.unlink(file.path).catch(() => {});
    }

    // Web-accessible relative path, statically served from /uploads.
    photoPaths.push(`/uploads/${cardId}/${filename}`);
  }

  return photoPaths;
}

/**
 * Remove all stored images for a given card (used e.g. on card deletion or
 * cleanup after a failed create). Safe against path traversal via the same
 * resolved-path containment check used for writes.
 */
async function deleteCardImages(cardId) {
  const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
  const cardUploadDir = getSafeCardUploadDir(cardId);
  const resolvedCardDir = path.resolve(cardUploadDir);

  const relative = path.relative(resolvedUploadsDir, resolvedCardDir);
  const isInside =
    relative === cardId &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative);

  if (!isInside) {
    throw new Error('Refusing to delete a path outside the uploads directory');
  }

  await fsPromises.rm(resolvedCardDir, { recursive: true, force: true });
}

/**
 * Serialize an array of photo path strings into the JSON string stored in
 * the cards.photo_paths column.
 */
function toPhotoPathsJson(photoPaths) {
  if (!Array.isArray(photoPaths)) {
    return JSON.stringify([]);
  }
  return JSON.stringify(photoPaths.filter((p) => typeof p === 'string'));
}

/**
 * Parse the cards.photo_paths JSON column value back into a plain array of
 * path strings. Always returns an array, even for null/invalid input.
 */
function fromPhotoPathsJson(photoPathsJson) {
  if (!photoPathsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(photoPathsJson);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch (err) {
    return [];
  }
}

module.exports = {
  UPLOADS_DIR,
  MAX_PHOTOS,
  validateCardId,
  getSafeCardUploadDir,
  ensureCardUploadDir,
  processImages,
  deleteCardImages,
  toPhotoPathsJson,
  fromPhotoPathsJson,
};