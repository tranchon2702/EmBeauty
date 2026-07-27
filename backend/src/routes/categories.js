import express from 'express';
import Category from '../models/Category.js';
import Service from '../models/Service.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Default categories to seed if empty
const DEFAULT_CATEGORIES = [
  { key: 'nails', name: 'Nails (Móng)', icon: '💅', order: 1 },
  { key: 'eyelashes', name: 'Nối Mi', icon: '✨', order: 2 },
  { key: 'washing', name: 'Gội Đầu & Massage', icon: '🧴', order: 3 },
  { key: 'makeup', name: 'Makeup', icon: '💄', order: 4 },
];

export const seedCategoriesIfEmpty = async () => {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES);
      console.log('seeded default categories');
    }
  } catch (err) {
    console.error('Error seeding categories:', err);
  }
};

// GET all categories
router.get('/', async (req, res) => {
  try {
    let categories = await Category.find().sort({ order: 1, createdAt: 1 });
    if (categories.length === 0) {
      await seedCategoriesIfEmpty();
      categories = await Category.find().sort({ order: 1, createdAt: 1 });
    }
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE category
router.post('/', requireAdmin, async (req, res) => {
  const { name, icon, key } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Tên danh mục không được để trống' });
  }

  try {
    const generatedKey = (key && key.trim())
      ? key.trim().toLowerCase().replace(/\s+/g, '_')
      : 'cat_' + Date.now();

    const existing = await Category.findOne({ $or: [{ key: generatedKey }, { name: name.trim() }] });
    if (existing) {
      return res.status(400).json({ message: 'Danh mục đã tồn tại' });
    }

    const count = await Category.countDocuments();
    const category = new Category({
      key: generatedKey,
      name: name.trim(),
      icon: icon || '✨',
      order: count + 1
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE category
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, icon, order } = req.body;

  try {
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ message: 'Danh mục không tồn tại' });

    if (name !== undefined) category.name = name.trim();
    if (icon !== undefined) category.icon = icon;
    if (order !== undefined) category.order = order;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE category
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ message: 'Danh mục không tồn tại' });

    // Check if services belong to this category key
    const servicesCount = await Service.countDocuments({ category: category.key });
    if (servicesCount > 0) {
      return res.status(400).json({
        message: `Không thể xóa: Đang có ${servicesCount} dịch vụ thuộc danh mục "${category.name}". Vui lòng chuyển hoặc xóa dịch vụ trước.`
      });
    }

    await Category.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa danh mục' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
