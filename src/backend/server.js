require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const cardsRouter = require('./routes/cards');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// --- Secrets validation -----------------------------------------------
// Never allow known/hardcoded secrets to silently protect sessions or
// signed cookies in production. Fail fast instead.
const DEV_ONLY_SESSION_SECRET = 'dev-session-secret-change-me';
const DEV_ONLY_COOKIE_SECRET = 'dev-cookie-secret';

let SESSION_SECRET = process.env.SESSION_SECRET;
let COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!SESSION_SECRET || !COOKIE_SECRET) {
  if (isProduction) {
    console.error(
      'FATAL: SESSION_SECRET and COOKIE_SECRET environment variables must ' +
        'be set in production. Refusing to start with insecure defaults.'
    );
    process.exit(1);
  } else {
    console.warn(
      'WARNING: SESSION_SECRET and/or COOKIE_SECRET not set. Falling back ' +
        'to insecure development-only defaults. Do NOT use this in production.'
    );
    SESSION_SECRET = SESSION_SECRET || DEV_ONLY_SESSION_SECRET;
    COOKIE_SECRET = COOKIE_SECRET || DEV_ONLY_COOKIE_SECRET;
  }
}

// --- Core middleware -----------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));

app.use(
  session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// --- Static assets ---------------------------------------------------------
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- API routes -------------------------------------------------------------
app.use('/api/cards', cardsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Frontend (SPA) -----------------------------------------------------
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));

  // SPA fallback: serve index.html for any non-API, non-uploads route
  // (covers client-side routes such as /admin, /:cardId, etc.)
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/uploads/')
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });
} else {
  console.warn(
    `Frontend build not found at ${frontendDistDir}. Run the frontend ` +
      'build before starting the server in production.'
  );
}

// --- Error handling -----------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: isProduction ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (${NODE_ENV})`);
});

module.exports = app;