import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

// Route imports
import customerRoutes from './routes/customers.js';
import bookingRoutes from './routes/bookings.js';
import employeeRoutes from './routes/employees.js';
import invoiceRoutes from './routes/invoices.js';
import settingsRoutes from './routes/settings.js';
import serviceRoutes from './routes/services.js';
import bankAccountRoutes from './routes/bank-accounts.js';
import { startCronJobs } from './cron/dailyReminder.js';

// Configure dotenv
dotenv.config();

// Connect to MongoDB
connectDB();

// Start scheduled cron jobs (daily reminder etc.)
// startCronJobs();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'EM Beauty Nails & Makeup — Internal API v1.0' });
});

// Mount Routes
app.use('/api/customers', customerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
