import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import database (initializes schema & seeds on first run)
import './database.js';

// Route modules
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';

const app = express();
const PORT = process.env.PORT || 3000;

/* ──────────────────────────────────────────
   Middleware
   ────────────────────────────────────────── */

// CORS – allow Vite dev server and common local origins
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
}));

// JSON body parser with generous limit for base64 images
app.use(express.json({ limit: '10mb' }));

/* ──────────────────────────────────────────
   API Routes
   ────────────────────────────────────────── */

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);

/* ──────────────────────────────────────────
   Health check
   ────────────────────────────────────────── */

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ──────────────────────────────────────────
   404 fallback for API routes
   ────────────────────────────────────────── */

app.use('/api/{*path}', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

/* ──────────────────────────────────────────
   Global error handler
   ────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

/* ──────────────────────────────────────────
   Start
   ────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`\n🍃 Farsly API server running at http://localhost:${PORT}\n`);
});
