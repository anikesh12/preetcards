/**
 * Input sanitization helpers for card creation.
 * Strips HTML tags/scripts from free-text fields and enforces
 * sensible length limits before data is persisted to SQLite.
 *
 * Kept dependency-free on purpose (no external HTML parser) to stay
 * consistent with the project's minimal-dependency MVP approach.
 */

const DEFAULT_NAME_MAX_LENGTH = 100;
const DEFAULT_MESSAGE_MAX_LENGTH = 500;

/**
 * Remove HTML tags, HTML comments, and script/style block contents
 * from a string. This is a defense-in-depth measure — output is
 * always treated as plain text by the frontend, but we don't want
 * raw markup persisted or reflected back in API responses.
 * @param {string} input
 * @returns {string}
 */
function stripHtml(input) {
  if (typeof input !== 'string') return '';

  let output = input;

  // Remove script/style elements including their content.
  output = output.replace(/<script[\s\S]*?<\/script>/gi, '');
  output = output.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove HTML comments.
  output = output.replace(/<!--[\s\S]*?-->/g, '');

  // Strip any remaining tags (opening, closing, self-closing).
  output = output.replace(/<\/?[a-zA-Z!][^>]*>/g, '');

  return output;
}

/**
 * Decode a small set of common HTML entities so stripped text
 * doesn't retain encoded markup artifacts (e.g. "&lt;b&gt;").
 * @param {string} input
 * @returns {string}
 */
function decodeCommonEntities(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

/**
 * Collapse excessive whitespace/newlines while preserving intentional
 * single line breaks (useful for multi-paragraph birthday messages).
 * @param {string} input
 * @returns {string}
 */
function normalizeWhitespace(input) {
  if (typeof input !== 'string') return '';

  return input
    // Normalize CRLF / CR to LF.
    .replace(/\r\n?/g, '\n')
    // Collapse 3+ consecutive newlines down to 2 (one blank line max).
    .replace(/\n{3,}/g, '\n\n')
    // Collapse repeated spaces/tabs (but not newlines) into one space.
    .replace(/[ \t]{2,}/g, ' ')
    // Trim trailing whitespace on each line.
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Truncate a string to a maximum length without cutting a
 * multi-byte character in half.
 * @param {string} input
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(input, maxLength) {
  if (typeof input !== 'string') return '';
  if (typeof maxLength !== 'number' || maxLength < 0) return input;

  // Use Array.from to avoid splitting surrogate pairs (e.g. emoji).
  const chars = Array.from(input);
  if (chars.length <= maxLength) return input;

  return chars.slice(0, maxLength).join('');
}

/**
 * Core sanitize routine shared by name/message helpers.
 * @param {unknown} input
 * @param {{maxLength: number, collapseNewlines?: boolean}} options
 * @returns {string}
 */
function sanitizeText(input, options = {}) {
  const { maxLength = DEFAULT_MESSAGE_MAX_LENGTH, collapseNewlines = false } = options;

  if (input === null || input === undefined) return '';

  const stringInput = String(input);
  let sanitized = stripHtml(stringInput);
  sanitized = decodeCommonEntities(sanitized);
  sanitized = normalizeWhitespace(sanitized);

  if (collapseNewlines) {
    sanitized = sanitized.replace(/\n+/g, ' ');
  }

  sanitized = truncate(sanitized, maxLength);

  return sanitized;
}

/**
 * Sanitize a recipient name: strips HTML, collapses to a single
 * line, and enforces a max length.
 * @param {unknown} input
 * @param {number} [maxLength]
 * @returns {string}
 */
function sanitizeName(input, maxLength = DEFAULT_NAME_MAX_LENGTH) {
  return sanitizeText(input, { maxLength, collapseNewlines: true });
}

/**
 * Sanitize a birthday message: strips HTML, preserves line breaks,
 * and enforces a max length.
 * @param {unknown} input
 * @param {number} [maxLength]
 * @returns {string}
 */
function sanitizeMessage(input, maxLength = DEFAULT_MESSAGE_MAX_LENGTH) {
  return sanitizeText(input, { maxLength, collapseNewlines: false });
}

/**
 * Escape a string for safe inclusion in HTML output (used only if
 * server-rendered HTML ever needs to embed user text; the SPA relies
 * on React's default escaping for DOM rendering).
 * @param {string} input
 * @returns {string}
 */
function escapeHtml(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate that a sanitized value is non-empty and within bounds.
 * Useful for route-level validation after sanitizing.
 * @param {string} value
 * @param {{required?: boolean, maxLength?: number}} options
 * @returns {{valid: boolean, error?: string}}
 */
function validateLength(value, options = {}) {
  const { required = true, maxLength } = options;
  const stringValue = typeof value === 'string' ? value : '';

  if (required && stringValue.trim().length === 0) {
    return { valid: false, error: 'This field is required.' };
  }

  if (typeof maxLength === 'number' && Array.from(stringValue).length > maxLength) {
    return { valid: false, error: `Must be ${maxLength} characters or fewer.` };
  }

  return { valid: true };
}

module.exports = {
  DEFAULT_NAME_MAX_LENGTH,
  DEFAULT_MESSAGE_MAX_LENGTH,
  stripHtml,
  sanitizeText,
  sanitizeName,
  sanitizeMessage,
  escapeHtml,
  validateLength,
};