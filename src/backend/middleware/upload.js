const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UPLOADS_DIR } = require('../config/paths');

// Temp storage location — raw uploads land here before their contents
// are verified and (later, in the route/controller) resized/optimized
// into the public /uploads folder.
const TMP_DIR = path.join(UPLOADS_DIR, 'tmp');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per file
const MAX_FILES = 6;

// First-pass filter based on the client-supplied mimetype header.
// IMPORTANT: this is NOT a security boundary — a client can send any
// Content-Type it wants. It only exists to cheaply reject obviously
// wrong uploads before they hit disk. The real, trustworthy check is
// `verifyImageContents` below, which inspects actual file bytes via
// sharp after the upload completes.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Maps a verified (magic-byte-detected) image format to the file
// extension we actually write to disk. Extensions/filenames are NEVER
// derived from user-supplied `originalname`.
const FORMAT_TO_EXT = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
};

function randomToken() {
  return crypto.randomBytes(8).toString('hex');
}

function generateTempFilename() {
  // Extension-less, non-guessable temp name. Real extension is
  // assigned only after the file's actual contents are verified.
  return `${Date.now()}-${randomToken()}.upload`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, generateTempFilename());
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    err.message = 'Only JPEG, PNG, WEBP, and GIF images are allowed.';
    cb(err);
    return;
  }
  cb(null, true);
}

// Multer instance for use in routes, e.g. upload.array('photos', MAX_FILES)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

function cleanupFiles(files) {
  if (!files) return;
  for (const file of files) {
    if (file && file.path) {
      fs.unlink(file.path, () => {});
    }
  }
}

/**
 * Middleware to run AFTER upload.array()/upload.single().
 *
 * Verifies each uploaded file's real content by reading its actual
 * bytes via sharp.metadata() — this does NOT trust the client-supplied
 * mimetype or the originalname extension, so a spoofed non-image file
 * (e.g. .php/.svg/.html sent with a fake Content-Type) will fail
 * verification here even if it slipped past fileFilter.
 *
 * On success, each file is renamed on disk to a freshly generated,
 * random filename whose extension is derived solely from the detected
 * format, and `file.path` / `file.filename` / `file.verifiedFormat`
 * are updated to reflect this for downstream processing (e.g. sharp
 * resize/optimize steps in the route handler).
 *
 * On failure, all files for the request are deleted and a 400 error
 * is passed to next().
 */
async function verifyImageContents(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);

  if (!files.length) {
    return next();
  }

  try {
    for (const file of files) {
      let metadata;
      try {
        metadata = await sharp(file.path).metadata();
      } catch (err) {
        throw Object.assign(new Error('One or more files is not a valid image.'), { status: 400 });
      }

      const format = metadata.format;
      const ext = FORMAT_TO_EXT[format];

      if (!ext) {
        throw Object.assign(new Error('Unsupported or unrecognized image format.'), { status: 400 });
      }

      const safeFilename = `${Date.now()}-${randomToken()}${ext}`;
      const safePath = path.join(TMP_DIR, safeFilename);

      fs.renameSync(file.path, safePath);

      file.path = safePath;
      file.filename = safeFilename;
      file.verifiedFormat = format;
    }

    next();
  } catch (err) {
    cleanupFiles(files);
    err.status = err.status || 400;
    next(err);
  }
}

/**
 * Express error-handling middleware to translate multer/verification
 * errors into clean JSON responses. Mount immediately after routes
 * that use `upload`.
 */
function handleUploadErrors(err, req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    let message = err.message || 'Upload failed.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `Each photo must be smaller than ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = err.message || `You can upload up to ${MAX_FILES} photos.`;
    }
    return res.status(400).json({ error: message });
  }

  if (err.status === 400) {
    return res.status(400).json({ error: err.message });
  }

  next(err);
}

module.exports = {
  upload,
  verifyImageContents,
  handleUploadErrors,
  cleanupFiles,
  TMP_DIR,
  MAX_FILE_SIZE,
  MAX_FILES,
  ALLOWED_MIME_TYPES,
  FORMAT_TO_EXT,
};