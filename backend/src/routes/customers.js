import express from 'express';
import Customer from '../models/Customer.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getSettings } from './settings.js';
import { resolveRank } from '../lib/loyalty.js';

const router = express.Router();

// ─── PUBLIC: Lookup loyalty points by phone ──────────────────────────────────
// Used by the customer-facing /tick page (no login required). Throttled so the
// endpoint cannot be walked to harvest the customer list.
router.get(
  '/lookup',
  rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: 'Bạn tra cứu hơi nhanh. Vui lòng thử lại sau một lát nhé!',
  }),
  async (req, res) => {
    const phone = (req.query.phone || '').trim();
    if (!phone) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại' });
    }

    try {
      const customer = await Customer.findOne({ phone });
      if (!customer) {
        return res.status(404).json({ message: 'Không tìm thấy thông tin số điện thoại này' });
      }

      const settings = await getSettings();
      // Older records were created before lifetime points existed; fall back to
      // the current balance so their tier is not understated.
      const lifetime = customer.totalPointsEarned || customer.points || 0;

      res.json({
        name: customer.name,
        phone: customer.phone,
        points: customer.points || 0,
        totalPointsEarned: lifetime,
        lastVisitAt: customer.lastVisitAt || null,
        rank: resolveRank(lifetime, settings.rankSettings || {}),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ─── All routes below require authentication ─────────────────────────────────
router.use(requireAuth);

// Get customer by phone (internal use — returns full data)
router.get('/', async (req, res) => {
  const phone = (req.query.phone || '').trim();
  if (!phone) {
    return res.status(400).json({ message: 'Vui lòng nhập số điện thoại' });
  }

  try {
    const customer = await Customer.findOne({ phone });
    if (!customer) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const settings = await getSettings();
    const lifetime = customer.totalPointsEarned || customer.points || 0;

    res.json({
      ...customer.toObject(),
      totalPointsEarned: lifetime,
      rank: resolveRank(lifetime, settings.rankSettings || {}),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create customer manually (normally happens automatically on first payment)
router.post('/', async (req, res) => {
  const { name, phone } = req.body;

  if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
    return res.status(400).json({ message: 'Tên và số điện thoại là bắt buộc' });
  }

  try {
    const trimmedPhone = String(phone).trim();
    const existing = await Customer.findOne({ phone: trimmedPhone });
    if (existing) {
      return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký' });
    }

    const customer = new Customer({ name: String(name).trim(), phone: trimmedPhone });
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
