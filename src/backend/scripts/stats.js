/**
 * Internal-only stats lookup. Not exposed via any API route -- run this
 * directly on the server when you (or a creator asking about their card)
 * need the numbers.
 *
 * Usage:
 *   node scripts/stats.js                 -- summary of every card
 *   node scripts/stats.js <cardSlug>       -- detail for one card
 */
const { db } = require('../db');
const { getCardViewStats } = require('../utils/analytics');

const slugArg = process.argv[2];

if (slugArg) {
  const card = db.prepare('SELECT slug, recipient_name, occasion, created_at FROM cards WHERE slug = ?').get(slugArg);
  if (!card) {
    console.log(`No card found with slug "${slugArg}".`);
    process.exit(1);
  }
  const { overallViews, uniqueViews } = getCardViewStats(slugArg);
  console.log(`Card:            ${card.slug}`);
  console.log(`Recipient:       ${card.recipient_name}`);
  console.log(`Occasion:        ${card.occasion}`);
  console.log(`Created:         ${card.created_at}`);
  console.log(`Overall views:   ${overallViews}`);
  console.log(`Unique views:    ${uniqueViews}`);
  process.exit(0);
}

const cards = db.prepare('SELECT slug, recipient_name, occasion, created_at FROM cards ORDER BY created_at DESC').all();

if (cards.length === 0) {
  console.log('No cards created yet.');
  process.exit(0);
}

const rows = cards.map((card) => {
  const { overallViews, uniqueViews } = getCardViewStats(card.slug);
  return { ...card, overallViews, uniqueViews };
});

rows.sort((a, b) => b.uniqueViews - a.uniqueViews);

console.log(
  `${'Slug'.padEnd(12)} ${'Recipient'.padEnd(20)} ${'Occasion'.padEnd(15)} ${'Overall'.padEnd(9)} ${'Unique'.padEnd(8)} Created`
);
for (const row of rows) {
  console.log(
    `${row.slug.padEnd(12)} ${row.recipient_name.slice(0, 19).padEnd(20)} ${row.occasion.padEnd(15)} ` +
    `${String(row.overallViews).padEnd(9)} ${String(row.uniqueViews).padEnd(8)} ${row.created_at}`
  );
}

const totalCreates = db.prepare(`SELECT COUNT(*) AS count FROM events WHERE event_type = 'create'`).get().count;
const totalViews = db.prepare(`SELECT COUNT(*) AS count FROM events WHERE event_type = 'view'`).get().count;
const totalUniqueDevices = db.prepare(`SELECT COUNT(DISTINCT device_id) AS count FROM events`).get().count;

console.log('');
console.log(`Total cards created (events): ${totalCreates}`);
console.log(`Total view events:            ${totalViews}`);
console.log(`Total distinct devices seen:  ${totalUniqueDevices}`);
