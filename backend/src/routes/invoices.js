import express from 'express';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// Generate unique invoice number
const generateInvoiceNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HD-${dateStr}-${rand}`;
};

// ─── CREATE DRAFT INVOICE ────────────────────────────────────────────────────
// Creates a draft invoice. Points are NOT yet applied. Customer lookup optional.
router.post('/', async (req, res) => {
  const {
    customerPhone,
    customerName,
    employeeId,
    services,
    discount,
    surcharge,
    surchargeNote,
    totalAmount,
    paymentMethod,
    bankAccountId,
    note
  } = req.body;

  if (!employeeId || !services || services.length === 0 || totalAmount === undefined) {
    return res.status(400).json({ message: 'employeeId, services, và totalAmount là bắt buộc' });
  }

  try {
    const invoice = new Invoice({
      invoiceNumber: generateInvoiceNumber(),
      customerPhone: customerPhone ? customerPhone.trim() : '',
      customerName: customerName ? customerName.trim() : '',
      employeeId,
      services,
      discount: discount || 0,
      surcharge: surcharge || 0,
      surchargeNote: surchargeNote || '',
      totalAmount,
      paymentMethod: paymentMethod || 'cash',
      bankAccountId: bankAccountId || null,
      status: 'draft',
      note: note || ''
    });

    await invoice.save();
    const populated = await invoice.populate('employeeId', 'name avatar');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── UPDATE DRAFT INVOICE (edit before payment) ──────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    services,
    discount,
    surcharge,
    surchargeNote,
    totalAmount,
    paymentMethod,
    bankAccountId,
    note,
    customerPhone,
    customerName
  } = req.body;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Không thể sửa hóa đơn đã thanh toán' });
    }

    if (services !== undefined) invoice.services = services;
    if (discount !== undefined) invoice.discount = discount;
    if (surcharge !== undefined) invoice.surcharge = surcharge;
    if (surchargeNote !== undefined) invoice.surchargeNote = surchargeNote;
    if (totalAmount !== undefined) invoice.totalAmount = totalAmount;
    if (paymentMethod !== undefined) invoice.paymentMethod = paymentMethod;
    if (bankAccountId !== undefined) invoice.bankAccountId = bankAccountId || null;
    if (note !== undefined) invoice.note = note;
    if (customerPhone !== undefined) invoice.customerPhone = customerPhone;
    if (customerName !== undefined) invoice.customerName = customerName;

    await invoice.save();
    const populated = await invoice.populate('employeeId', 'name avatar');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── MARK AS PAID ────────────────────────────────────────────────────────────
// Finalises the invoice: applies loyalty points, records paidAt timestamp.
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, bankAccountId } = req.body;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Hóa đơn đã được đánh dấu thanh toán rồi' });
    }

    // 1. Get settings for reward rate
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    const rewardRate = settings.pointRewardRate || 10;

    // 2. Calculate points earned
    const pointsEarned = Math.floor((invoice.totalAmount * rewardRate) / 100000);

    // 3. Update or create Customer if phone provided
    if (invoice.customerPhone && invoice.customerPhone.trim() !== '') {
      const phoneClean = invoice.customerPhone.trim();
      let customer = await Customer.findOne({ phone: phoneClean });
      if (!customer) {
        customer = new Customer({
          name: invoice.customerName || 'Khách hàng',
          phone: phoneClean,
          points: pointsEarned
        });
      } else {
        customer.points += pointsEarned;
        if (invoice.customerName && invoice.customerName !== 'Khách hàng mới') {
          customer.name = invoice.customerName;
        }
      }
      await customer.save();
    }

    // 4. Mark invoice as paid
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.pointsEarned = pointsEarned;
    if (paymentMethod) invoice.paymentMethod = paymentMethod;
    if (bankAccountId !== undefined) invoice.bankAccountId = bankAccountId || null;

    await invoice.save();
    const populated = await invoice.populate('employeeId', 'name');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── CANCEL INVOICE ──────────────────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Không thể hủy hóa đơn đã thanh toán' });
    }
    invoice.status = 'cancelled';
    await invoice.save();
    res.json({ message: 'Hóa đơn đã được hủy', invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET INVOICES LIST ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, employeeId, date } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId;
    if (date) {
      const day = new Date(date);
      const start = new Date(day); start.setHours(0, 0, 0, 0);
      const end = new Date(day); end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const list = await Invoice.find(filter)
      .populate('employeeId', 'name avatar')
      .populate('bankAccountId', 'bankName accountNumber displayName')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET SINGLE INVOICE ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('employeeId', 'name avatar')
      .populate('bankAccountId', 'bankName accountNumber accountHolder bankId displayName qrImageBase64');
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── TODAY'S STATS ───────────────────────────────────────────────────────────
router.get('/stats/today', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Only count PAID invoices for revenue
    const invoices = await Invoice.find({
      status: 'paid',
      paidAt: { $gte: startOfToday, $lte: endOfToday }
    }).populate('employeeId', 'name avatar');

    let totalRevenue = 0;
    let cashRevenue = 0;
    let bankRevenue = 0;
    const employeeBreakdown = {};

    invoices.forEach((inv) => {
      totalRevenue += inv.totalAmount;
      if (inv.paymentMethod === 'bank') {
        bankRevenue += inv.totalAmount;
      } else {
        cashRevenue += inv.totalAmount;
      }

      const empId = inv.employeeId?._id?.toString() || 'unknown';
      const empName = inv.employeeId?.name || 'Khác';
      const empAvatar = inv.employeeId?.avatar || '';

      if (!employeeBreakdown[empId]) {
        employeeBreakdown[empId] = {
          name: empName,
          avatar: empAvatar,
          amount: 0,
          invoiceCount: 0
        };
      }
      employeeBreakdown[empId].amount += inv.totalAmount;
      employeeBreakdown[empId].invoiceCount += 1;
    });

    res.json({
      totalRevenue,
      cashRevenue,
      bankRevenue,
      invoiceCount: invoices.length,
      employeeStats: Object.values(employeeBreakdown)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── LEGACY: keep /stats alias working ───────────────────────────────────────
router.get('/stats', async (req, res) => {
  res.redirect('/api/invoices/stats/today');
});

export default router;
