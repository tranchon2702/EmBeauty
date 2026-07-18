import express from 'express';
import Service from '../models/Service.js';

const router = express.Router();

// GET all services
router.get('/', async (req, res) => {
  try {
    const list = await Service.find().sort({ category: 1, name: 1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create service
router.post('/', async (req, res) => {
  const { name, price, category, duration } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ message: 'Name, price, and category are required' });
  }

  try {
    const service = new Service({
      name: name.trim(),
      price: Number(price),
      category,
      duration: duration ? Number(duration) : 60
    });

    await service.save();
    res.status(201).json(service);
  } catch (error) {
    res.status(550).json({ message: error.message });
  }
});

// PUT update service
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, category, duration } = req.body;

  try {
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (name !== undefined) service.name = name.trim();
    if (price !== undefined) service.price = Number(price);
    if (category !== undefined) service.category = category;
    if (duration !== undefined) service.duration = Number(duration);

    await service.save();
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE service
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const service = await Service.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
