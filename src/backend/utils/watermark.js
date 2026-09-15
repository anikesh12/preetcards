const sharp = require('sharp');

const WATERMARK_TEXT = 'PreetCards \u{1F389}';

/**
 * Composites a small, semi-transparent brand watermark into the bottom-right
 * corner of an image and returns the result as a JPEG buffer. Used for the
 * free/default photo download -- paying to remove this badge is the upsell.
 *
 * Sized proportionally to the source image so it looks consistent whether
 * the photo is small or large, rather than a fixed pixel size that could
 * dwarf a small image or be unreadable on a big one.
 */
async function watermarkImage(inputPath) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const imgWidth = metadata.width || 1200;
  const imgHeight = metadata.height || 1200;

  // sharp's composite() requires the overlay to fit within the base image,
  // so every dimension below is clamped to the actual photo size -- a very
  // small upload must never produce a badge larger than the photo itself.
  const badgeWidth = Math.max(1, Math.min(imgWidth, Math.round(imgWidth * 0.55)));
  const badgeHeight = Math.max(1, Math.min(imgHeight, Math.round(imgWidth * 0.032) + 20));
  const fontSize = Math.max(1, Math.min(Math.round(imgWidth * 0.032), badgeHeight - 6));

  const svg = Buffer.from(`
    <svg width="${badgeWidth}" height="${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${badgeWidth - Math.min(14, badgeWidth)}" y="${badgeHeight / 2}" font-family="sans-serif" font-size="${fontSize}"
            font-weight="700" fill="rgba(255,255,255,0.9)" text-anchor="end" dominant-baseline="middle"
            stroke="rgba(0,0,0,0.55)" stroke-width="4" paint-order="stroke">${WATERMARK_TEXT}</text>
    </svg>
  `);

  return image
    .composite([{ input: svg, gravity: 'southeast' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

module.exports = { watermarkImage };
