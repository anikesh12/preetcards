const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { db } = require('../analytics');

router.use(adminAuth);

function getCardCreationTotals() {
  const lifetime = db
    .prepare(`SELECT COUNT(*) AS count FROM cards`)
    .get().count;

  const daily = db
    .prepare(
      `SELECT COUNT(*) AS count FROM cards
       WHERE datetime(created_at) >= datetime('now', '-1 day')`
    )
    .get().count;

  const weekly = db
    .prepare(
      `SELECT COUNT(*) AS count FROM cards
       WHERE datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get().count;

  return { lifetime, daily, weekly };
}

function getViewTotals() {
  const lifetime = db
    .prepare(`SELECT COUNT(*) AS count FROM card_views`)
    .get().count;

  const daily = db
    .prepare(
      `SELECT COUNT(*) AS count FROM card_views
       WHERE datetime(created_at) >= datetime('now', '-1 day')`
    )
    .get().count;

  const weekly = db
    .prepare(
      `SELECT COUNT(*) AS count FROM card_views
       WHERE datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get().count;

  return { lifetime, daily, weekly };
}

function getUniqueDeviceViewTotals() {
  const totalViews = db
    .prepare(`SELECT COUNT(*) AS count FROM card_views`)
    .get().count;

  const uniqueDevices = db
    .prepare(
      `SELECT COUNT(DISTINCT device_id) AS count FROM card_views
       WHERE device_id IS NOT NULL`
    )
    .get().count;

  const dailyTotalViews = db
    .prepare(
      `SELECT COUNT(*) AS count FROM card_views
       WHERE datetime(created_at) >= datetime('now', '-1 day')`
    )
    .get().count;

  const dailyUniqueDevices = db
    .prepare(
      `SELECT COUNT(DISTINCT device_id) AS count FROM card_views
       WHERE device_id IS NOT NULL
         AND datetime(created_at) >= datetime('now', '-1 day')`
    )
    .get().count;

  const weeklyTotalViews = db
    .prepare(
      `SELECT COUNT(*) AS count FROM card_views
       WHERE datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get().count;

  const weeklyUniqueDevices = db
    .prepare(
      `SELECT COUNT(DISTINCT device_id) AS count FROM card_views
       WHERE device_id IS NOT NULL
         AND datetime(created_at) >= datetime('now', '-7 days')`
    )
    .get().count;

  return {
    lifetime: { total: totalViews, uniqueDevices },
    daily: { total: dailyTotalViews, uniqueDevices: dailyUniqueDevices },
    weekly: { total: weeklyTotalViews, uniqueDevices: weeklyUniqueDevices },
  };
}

router.get('/stats/cards', (req, res) => {
  try {
    const totals = getCardCreationTotals();
    res.json(totals);
  } catch (err) {
    console.error('Failed to fetch card creation stats:', err);
    res.status(500).json({ error: 'Failed to fetch card creation stats' });
  }
});

router.get('/stats/views', (req, res) => {
  try {
    const totals = getViewTotals();
    res.json(totals);
  } catch (err) {
    console.error('Failed to fetch view stats:', err);
    res.status(500).json({ error: 'Failed to fetch view stats' });
  }
});

router.get('/stats/views/devices', (req, res) => {
  try {
    const totals = getUniqueDeviceViewTotals();
    res.json(totals);
  } catch (err) {
    console.error('Failed to fetch device view stats:', err);
    res.status(500).json({ error: 'Failed to fetch device view stats' });
  }
});

router.get('/stats', (req, res) => {
  try {
    const cards = getCardCreationTotals();
    const views = getViewTotals();
    const deviceViews = getUniqueDeviceViewTotals();
    res.json({ cards, views, deviceViews });
  } catch (err) {
    console.error('Failed to fetch admin stats:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

module.exports = router;