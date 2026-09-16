require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const cardsRouter = require('./routes/cards');
const configRouter = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// App-wide config, populated from environment variables.
// Exposed (safely) via the /api/config route for the frontend to consume.
// ---------------------------------------------------------------------------
const appConfig = {
  adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
  adsenseSlotId: process.env.ADSENSE_SLOT_ID || '',
  tipJarUrl: process.env.TIP_JAR_URL || '',
  rewardedAdClientId: process.env.REWARDED_AD_CLIENT_ID || '',
  rewardedAdUnitId: process.env.REWARDED_AD_UNIT_ID || '',
};

// Make config available to routes via app locals.
app.set('config', appConfig);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists and serve it statically.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/cards', cardsRouter);
app.use('/api/config', configRouter);

// ---------------------------------------------------------------------------
// Serve built frontend (production)
// ---------------------------------------------------------------------------
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;