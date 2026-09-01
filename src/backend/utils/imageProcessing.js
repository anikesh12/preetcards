/**
 * imageProcessing.js
 *
 * Server-side image processing utilities for uploaded card photos.
 * - Validates incoming files (type/size)
 * - Resizes + compresses a "full" web-display version
 * - Generates a consistent aspect-ratio thumbnail (cropped square)
 * - Persists both to local disk under /uploads/full and /uploads/thumbs
 * - Exposes public URL paths for use by the API layer
 *
 * Uses sharp for all image manipulation. Designed to be dependency-light
 * and to run synchronously (awaited) during the upload request lifecycle.
 */

const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const FULL_DIR = path.join(UPLOADS_ROOT, 'full');
const THUMB_DIR = path.join(UPLOADS_ROOT, 'thumbs');

// Public URL prefixes — must match how Express serves the /uploads folder
// statically (e.g. app.use('/uploads', express.static(UPLOADS_ROOT))).
const FULL_URL_PREFIX = '/uploads/full';
const THUMB_URL_PREFIX = '/uploads/thumbs';

const FULL_MAX_WIDTH = 1600;
const FULL_MAX_HEIGHT = 1600;
const FULL_QUALITY = 80;

// Fixed square-ish aspect ratio thumbnails so gallery grids line up neatly.
const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 480;
const THUMB_QUALITY = 75;

const OUTPUT_EXTENSION = '.webp';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per photo
const MAX_FILES_PER_CARD = 6;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Ensures the upload directory structure exists on disk.
 * Should be called once at server startup.
 */
async function ensureUploadDirs() {
  await fs.mkdir(FULL_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class ImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImageValidationError';
    this.statusCode = 400;
  }
}

/**
 * Validates a single uploaded file's mimetype and size before processing.
 * @param {{ mimetype: string, size: number, originalname?: string }} file
 * @throws {ImageValidationError}
 */
function validateImageFile(file) {
  if (!file) {
    throw new ImageValidationError('No file provided.');
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ImageValidationError(
      `Unsupported file type: ${file.mimetype}. Please upload JPEG, PNG, WEBP, GIF, or HEIC images.`
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    throw new ImageValidationError(
      `File "${file.originalname || 'photo'}" is too large. Max size is ${maxMb}MB.`
    );
  }
}

/**
 * Validates an array of files as a batch (count + individual checks).
 * @param {Array<{ mimetype: string, size: number, originalname?: string }>} files
 */
function validateImageFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ImageValidationError('At least one photo is required.');
  }
  if (files.length > MAX_FILES_PER_CARD) {
    throw new ImageValidationError(`You can upload up to ${MAX_FILES_PER_CARD} photos.`);
  }
  files.forEach(validateImageFile);
}

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

function generateBaseFilename() {
  return crypto.randomBytes(12).toString('hex');
}

function toFullUrl(filename) {
  return `${FULL_URL_PREFIX}/${filename}`;
}

function toThumbUrl(filename) {
  return `${THUMB_URL_PREFIX}/${filename}`;
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Processes a single uploaded image buffer into a web-optimized full image
 * and a consistent-aspect-ratio thumbnail, writing both to disk as .webp.
 *
 * @param {Buffer} buffer - raw uploaded file bytes
 * @returns {Promise<{
 *   filename: string,
 *   thumbFilename: string,
 *   url: string,
 *   thumbUrl: string,
 *   width: number,
 *   height: number,
 *   thumbWidth: number,
 *   thumbHeight: number,
 *   size: number,
 *   thumbSize: number
 * }>}
 */
async function processUploadedImage(buffer) {
  await ensureUploadDirs();

  const baseName = generateBaseFilename();
  const filename = `${baseName}${OUTPUT_EXTENSION}`;
  const thumbFilename = `${baseName}_thumb${OUTPUT_EXTENSION}`;
  const fullPath = path.join(FULL_DIR, filename);
  const thumbPath = path.join(THUMB_DIR, thumbFilename);

  // Normalize orientation from EXIF data before any resizing.
  const source = sharp(buffer, { failOn: 'none' }).rotate();

  try {
    const fullPipeline = source
      .clone()
      .resize({
        width: FULL_MAX_WIDTH,
        height: FULL_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: FULL_QUALITY });

    const thumbPipeline = source
      .clone()
      .resize({
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        fit: 'cover',
        position: 'attention',
      })
      .webp({ quality: THUMB_QUALITY });

    const [fullInfo, thumbInfo] = await Promise.all([
      fullPipeline.toFile(fullPath),
      thumbPipeline.toFile(thumbPath),
    ]);

    return {
      filename,
      thumbFilename,
      url: toFullUrl(filename),
      thumbUrl: toThumbUrl(thumbFilename),
      width: fullInfo.width,
      height: fullInfo.height,
      thumbWidth: thumbInfo.width,
      thumbHeight: thumbInfo.height,
      size: fullInfo.size,
      thumbSize: thumbInfo.size,
    };
  } catch (err) {
    // Best-effort cleanup of any partially-written files.
    await Promise.allSettled([fs.unlink(fullPath), fs.unlink(thumbPath)]);
    const wrapped = new Error(`Failed to process image: ${err.message}`);
    wrapped.name = 'ImageProcessingError';
    wrapped.statusCode = 422;
    throw wrapped;
  }
}

/**
 * Processes multiple uploaded files (e.g. multer's req.files) in parallel.
 * If any single image fails to process, all successfully-written files from
 * this batch are rolled back (deleted) and the error is rethrown, so the
 * caller can respond with a clean failure rather than a partially-created card.
 *
 * @param {Array<{ buffer: Buffer, mimetype: string, size: number, originalname?: string }>} files
 * @returns {Promise<Array<ReturnType<typeof processUploadedImage> extends Promise<infer T> ? T : never>>}
 */
async function processCardImages(files) {
  validateImageFiles(files);

  const processed = [];
  try {
    for (const file of files) {
      // Processed sequentially to keep memory/CPU usage predictable for
      // an MVP running on modest hosting; still fast for typical photo counts.
      const result = await processUploadedImage(file.buffer);
      processed.push(result);
    }
    return processed;
  } catch (err) {
    await deleteImageSets(processed);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Deletes a single processed image's full + thumbnail files from disk.
 * Safe to call even if files are already missing.
 * @param {string} filename
 * @param {string} thumbFilename
 */
async function deleteImageSet(filename, thumbFilename) {
  const tasks = [];
  if (filename) {
    tasks.push(fs.unlink(path.join(FULL_DIR, filename)).catch(() => {}));
  }
  if (thumbFilename) {
    tasks.push(fs.unlink(path.join(THUMB_DIR, thumbFilename)).catch(() => {}));
  }
  await Promise.all(tasks);
}

/**
 * Deletes multiple processed image sets, e.g. all photos belonging to a card
 * that is being deleted or a failed upload batch being rolled back.
 * @param {Array<{ filename: string, thumbFilename: string }>} images
 */
async function deleteImageSets(images) {
  await Promise.all(
    (images || []).map((img) => deleteImageSet(img.filename, img.thumbFilename))
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Directory / URL config (for wiring up express.static and multer)
  UPLOADS_ROOT,
  FULL_DIR,
  THUMB_DIR,
  FULL_URL_PREFIX,
  THUMB_URL_PREFIX,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_CARD,
  ALLOWED_MIME_TYPES,

  // Lifecycle
  ensureUploadDirs,

  // Validation
  validateImageFile,
  validateImageFiles,
  ImageValidationError,

  // Processing
  processUploadedImage,
  processCardImages,

  // Cleanup
  deleteImageSet,
  deleteImageSets,
};