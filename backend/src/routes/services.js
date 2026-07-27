import express from 'express';
import Service from '../models/Service.js';
import Category from '../models/Category.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const parsePrice = (value) => {
  const price = Number(value);
  // 0 is deliberately allowed — used for complimentary / promotional items.
  if (!Number.isFinite(price) || price < 0) return null;
  return Math.round(price);
};

const assertCategoryExists = async (key) => {
  const exists = await Category.exists({ key });
  if (!exists) throw new Error(`Danh mục "${key}" không tồn tại`);
};

// ─── PUBLIC: list services ───────────────────────────────────────────────────
// `?activeOnly=true` is what the customer-facing price list and the invoice
// picker use, so a paused service disappears without being deleted.
router.get('/', async (req, res) => {
  try {
    const filter = req.query.activeOnly === 'true' ? { isActive: { $ne: false } } : {};
    const list = await Service.find(filter).sort({ category: 1, name: 1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: create ───────────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  const { name, price, category, description, isActive } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Tên dịch vụ là bắt buộc' });
  }
  if (!category) {
    return res.status(400).json({ message: 'Danh mục là bắt buộc' });
  }
  const parsedPrice = parsePrice(price);
  if (parsedPrice === null) {
    return res.status(400).json({ message: 'Đơn giá phải là số không âm' });
  }

  try {
    await assertCategoryExists(category);

    const service = new Service({
      name: String(name).trim(),
      price: parsedPrice,
      category,
      description: (description || '').trim(),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await service.save();
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── ADMIN: update ───────────────────────────────────────────────────────────
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, price, category, description, isActive } = req.body;

  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Tên dịch vụ không được để trống' });
      service.name = String(name).trim();
    }
    if (price !== undefined) {
      const parsedPrice = parsePrice(price);
      if (parsedPrice === null) return res.status(400).json({ message: 'Đơn giá phải là số không âm' });
      service.price = parsedPrice;
    }
    if (category !== undefined) {
      await assertCategoryExists(category);
      service.category = category;
    }
    if (description !== undefined) service.description = String(description).trim();
    if (isActive !== undefined) service.isActive = Boolean(isActive);

    await service.save();
    res.json(service);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── ADMIN: delete ───────────────────────────────────────────────────────────
// Past invoices keep their own name/price snapshot, so removing a service here
// never rewrites history.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    res.json({ message: 'Đã xóa dịch vụ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
