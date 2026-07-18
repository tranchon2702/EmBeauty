import express from 'express';
import Customer from '../models/Customer.js';

const router = express.Router();

// Get loyalty points by phone number
router.get('/', async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create customer (often done automatically or manually)
router.post('/', async (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ message: 'Name and phone are required' });
  }

  try {
    const existing = await Customer.findOne({ phone: phone.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Customer already exists' });
    }

    const customer = new Customer({
      name: name.trim(),
      phone: phone.trim(),
      points: 0
    });

    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
