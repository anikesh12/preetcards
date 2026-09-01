const crypto = require('crypto');

// URL-safe alphabet (no ambiguous characters like 0/O, 1/l/I)
const ALPHABET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const ALPHABET_LENGTH = ALPHABET.length;

const DEFAULT_LENGTH = 8;
const MAX_ATTEMPTS = 10;

/**
 * Generate a random URL-safe slug of the given length using
 * cryptographically secure randomness with rejection sampling
 * to avoid modulo bias.
 *
 * @param {number} length
 * @returns {string}
 */
function generateSlug(length = DEFAULT_LENGTH) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('generateSlug: length must be a positive integer');
  }

  // Largest multiple of ALPHABET_LENGTH that fits in a byte (0-255),
  // used to reject biased byte values and keep distribution uniform.
  const maxUnbiased = 256 - (256 % ALPHABET_LENGTH);

  let slug = '';
  while (slug.length < length) {
    const bytesNeeded = length - slug.length;
    const randomBytes = crypto.randomBytes(bytesNeeded);

    for (let i = 0; i < bytesNeeded && slug.length < length; i += 1) {
      const byte = randomBytes[i];
      if (byte < maxUnbiased) {
        slug += ALPHABET[byte % ALPHABET_LENGTH];
      }
      // else: reject and continue loop, more bytes will be generated
    }
  }

  return slug;
}

/**
 * Generate a slug that is guaranteed not to collide with an existing
 * card id in the database. Retries with the same length a few times,
 * then progressively increases length if collisions persist (extremely
 * unlikely in practice but guards against edge cases at scale).
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @param {object} [options]
 * @param {number} [options.length=8] - initial slug length
 * @param {string} [options.table='cards'] - table to check for collisions
 * @param {string} [options.column='id'] - primary key / slug column name
 * @returns {string} a unique slug not present in the database
 */
function generateUniqueSlug(db, options = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('generateUniqueSlug: a valid better-sqlite3 database instance is required');
  }

  const { length = DEFAULT_LENGTH, table = 'cards', column = 'id' } = options;

  // Validate table/column names against a strict pattern since they are
  // interpolated into SQL (identifiers cannot be parameterized).
  const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!identifierPattern.test(table) || !identifierPattern.test(column)) {
    throw new Error('generateUniqueSlug: invalid table or column name');
  }

  const checkStmt = db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`);

  let currentLength = length;
  let totalAttempts = 0;
  const maxTotalAttempts = MAX_ATTEMPTS * 3;

  while (totalAttempts < maxTotalAttempts) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const candidate = generateSlug(currentLength);
      const existing = checkStmt.get(candidate);
      totalAttempts += 1;

      if (!existing) {
        return candidate;
      }
    }
    // Persistent collisions at this length: widen the search space.
    currentLength += 1;
  }

  throw new Error('generateUniqueSlug: unable to generate a unique slug after multiple attempts');
}

module.exports = {
  generateSlug,
  generateUniqueSlug,
};