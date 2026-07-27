import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { assertAuthConfig } from './middleware/auth.js';
import { runStartupMigrations } from './lib/migrations.js';

// Route imports
import customerRoutes from './routes/customers.js';
import employeeRoutes from './routes/employees.js';
import invoiceRoutes from './routes/invoices.js';
import settingsRoutes from './routes/settings.js';
import serviceRoutes from './routes/services.js';
import bankAccountRoutes from './routes/bank-accounts.js';
import categoryRoutes, { seedCategoriesIfEmpty } from './routes/categories.js';

dotenv.config();

// Fail fast rather than booting production with the in-repo dev secrets.
assertAuthConfig();

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Locked to the salon's own domains in production; wide open in development.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.length === 0) {
      return callback(null, true);
    }
    // No Origin header: same-origin, curl, or a native app — not a browser
    // cross-site request, so there is nothing for CORS to protect against.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} không được phép truy cập API này`));
  },
}));

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('CẢNH BÁO: CORS_ORIGINS chưa được đặt — API đang chấp nhận mọi origin.');
}

// Base64 avatars and QR images travel in the JSON body.
app.use(express.json({ limit: '5mb' }));

// Correct client IPs behind the Nginx reverse proxy, so rate limiting keys on
// the real device rather than on 127.0.0.1.
app.set('trust proxy', 1);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'EM Beauty Nails & Makeup — Internal API v1.0' });
});

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/customers', customerRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/categories', categoryRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: `Không tìm thấy endpoint ${req.method} ${req.originalUrl}` });
});

// ─── Error handling ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Internal error text can leak schema and file paths, so only development
  // sees the real message.
  const message = process.env.NODE_ENV === 'production'
    ? 'Đã có lỗi xảy ra, vui lòng thử lại'
    : err.message || 'Internal Server Error';
  res.status(err.status || 500).json({ message });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    await seedCategoriesIfEmpty();
    await runStartupMigrations();
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Không thể khởi động server:', err.message);
    process.exit(1);
  });
