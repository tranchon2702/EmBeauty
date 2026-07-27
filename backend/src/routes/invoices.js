import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Settings from '../models/Settings.js';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { computeInvoiceTotals } from '../lib/invoiceTotals.js';
import { vnToday, vnStartOfDay, vnEndOfDay, vnDateCompact } from '../lib/time.js';

const router = express.Router();

// All invoice routes require authentication
router.use(requireAuth);

const MAX_PAGE_SIZE = 200;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Staff only ever see invoices they rang up or performed; admins see everything.
 * `createdBy` is absent on invoices written before it existed, hence the $or.
 */
const visibilityFilter = (req) => {
  if (isAdmin(req)) return {};
  const me = oid(req.user.id);
  return { $or: [{ createdBy: me }, { employeeId: me }] };
};

const canModify = (req, invoice) =>
  isAdmin(req) ||
  invoice.createdBy?.toString() === req.user.id ||
  invoice.employeeId?.toString() === req.user.id;

/**
 * Sequential per-day number: HD-20260726-0001.
 * Callers retry on duplicate-key, which covers two tills saving at once.
 */
const nextInvoiceNumber = async () => {
  const prefix = `HD-${vnDateCompact()}`;
  const last = await Invoice.findOne({ invoiceNumber: { $regex: `^${prefix}-` } })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();

  const lastSeq = last ? parseInt(last.invoiceNumber.slice(prefix.length + 1), 10) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
};

const POPULATE_LIST = [
  { path: 'employeeId', select: 'name avatar' },
  { path: 'bankAccountId', select: 'bankName accountNumber displayName' },
];

// ─── CREATE DRAFT INVOICE ────────────────────────────────────────────────────
// Money is always derived from the line items — see lib/invoiceTotals.js.
router.post('/', async (req, res) => {
  const {
    customerPhone, customerName, employeeId, services,
    discount, surcharge, surchargeNote, paymentMethod, bankAccountId, note,
  } = req.body;

  if (!employeeId || !isValidId(employeeId)) {
    return res.status(400).json({ message: 'Vui lòng chọn thợ thực hiện' });
  }

  let totals;
  try {
    totals = computeInvoiceTotals({ services, discount, surcharge });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const base = {
    customerPhone: (customerPhone || '').trim(),
    customerName: (customerName || '').trim(),
    employeeId,
    createdBy: req.user.id,
    ...totals,
    surchargeNote: (surchargeNote || '').trim(),
    paymentMethod: paymentMethod === 'bank' ? 'bank' : 'cash',
    bankAccountId: paymentMethod === 'bank' && isValidId(bankAccountId) ? bankAccountId : null,
    status: 'draft',
    note: (note || '').trim(),
  };

  // Two tills can pick the same sequence number; the unique index rejects the
  // loser, so retry with a freshly read sequence.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const invoice = new Invoice({ ...base, invoiceNumber: await nextInvoiceNumber() });
      await invoice.save();
      return res.status(201).json(await invoice.populate(POPULATE_LIST));
    } catch (error) {
      if (error?.code !== 11000) {
        return res.status(500).json({ message: error.message });
      }
    }
  }

  return res.status(503).json({ message: 'Hệ thống đang bận, vui lòng bấm lưu lại lần nữa' });
});

// ─── UPDATE DRAFT INVOICE (edit before payment) ──────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: 'Mã hóa đơn không hợp lệ' });

  const {
    services, discount, surcharge, surchargeNote,
    paymentMethod, bankAccountId, note, customerPhone, customerName, employeeId,
  } = req.body;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    if (!canModify(req, invoice)) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa hóa đơn này' });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Không thể sửa hóa đơn đã thanh toán' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(400).json({ message: 'Không thể sửa hóa đơn đã hủy' });
    }

    // Recompute from whichever line items are current after the edit.
    let totals;
    try {
      totals = computeInvoiceTotals({
        services: services !== undefined ? services : invoice.services,
        discount: discount !== undefined ? discount : invoice.discount,
        surcharge: surcharge !== undefined ? surcharge : invoice.surcharge,
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
    Object.assign(invoice, totals);

    if (employeeId !== undefined && isValidId(employeeId)) invoice.employeeId = employeeId;
    if (surchargeNote !== undefined) invoice.surchargeNote = String(surchargeNote).trim();
    if (note !== undefined) invoice.note = String(note).trim();
    if (customerPhone !== undefined) invoice.customerPhone = String(customerPhone).trim();
    if (customerName !== undefined) invoice.customerName = String(customerName).trim();
    if (paymentMethod !== undefined) invoice.paymentMethod = paymentMethod === 'bank' ? 'bank' : 'cash';
    if (bankAccountId !== undefined) {
      invoice.bankAccountId = isValidId(bankAccountId) ? bankAccountId : null;
    }
    if (invoice.paymentMethod === 'cash') invoice.bankAccountId = null;

    await invoice.save();
    res.json(await invoice.populate(POPULATE_LIST));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── MARK AS PAID ────────────────────────────────────────────────────────────
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: 'Mã hóa đơn không hợp lệ' });

  const { paymentMethod, bankAccountId } = req.body;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    if (!canModify(req, invoice)) {
      return res.status(403).json({ message: 'Bạn không có quyền thanh toán hóa đơn này' });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Hóa đơn đã được đánh dấu thanh toán rồi' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(400).json({ message: 'Hóa đơn đã bị hủy, không thể thanh toán' });
    }

    // ── LOYALTY POINTS DISABLED (tạm tắt tính năng tích điểm) ──────────────
    // let settings = await Settings.findOne();
    // if (!settings) settings = await new Settings().save();
    // const rewardRate = settings.pointRewardRate || 10;
    // const pointsEarned = Math.floor((invoice.totalAmount * rewardRate) / 100000);
    const pointsEarned = 0; // hardcode 0 khi tính năng tích điểm bị tắt

    const method = paymentMethod === 'bank' ? 'bank'
      : paymentMethod === 'cash' ? 'cash'
        : invoice.paymentMethod;
    const bank = method !== 'bank' ? null
      : bankAccountId !== undefined
        ? (isValidId(bankAccountId) ? bankAccountId : null)
        : invoice.bankAccountId;

    // Atomic claim: the status filter means a double-tap, or two devices racing,
    // can only settle this invoice once — so points cannot be awarded twice.
    const paid = await Invoice.findOneAndUpdate(
      { _id: id, status: 'draft' },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          pointsEarned,
          paymentMethod: method,
          bankAccountId: bank,
        },
      },
      { new: true }
    );

    if (!paid) {
      return res.status(409).json({ message: 'Hóa đơn vừa được xử lý ở nơi khác. Vui lòng tải lại.' });
    }

    // ── LOYALTY POINTS DISABLED (tạm tắt tính năng tích điểm) ──────────────
    // Loyalty is credited only after the sale is safely settled. $inc keeps
    // concurrent invoices for the same customer from clobbering each other.
    // let pointsWarning;
    const phone = (paid.customerPhone || '').trim();
    if (phone) {
      // Chỉ cập nhật lastVisitAt và tên khách, KHÔNG cộng điểm
      try {
        const named = paid.customerName && paid.customerName !== 'Khách hàng mới';
        await Customer.findOneAndUpdate(
          { phone },
          {
            // $inc: { points: pointsEarned, totalPointsEarned: pointsEarned }, // tạm tắt cộng điểm
            $set: { lastVisitAt: paid.paidAt, ...(named ? { name: paid.customerName } : {}) },
            $setOnInsert: { phone, ...(named ? {} : { name: 'Khách hàng' }) },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (err) {
        // The sale is recorded; only the loyalty credit failed. Surface it so
        // the till can fix it manually instead of silently losing the points.
        console.error(`Customer update failed for invoice ${paid.invoiceNumber}:`, err);
        // pointsWarning = 'Đã thu tiền thành công nhưng chưa cộng được điểm cho khách. Vui lòng báo quản lý.';
      }
    }

    const populated = await paid.populate(POPULATE_LIST);
    // res.json(pointsWarning ? { ...populated.toObject(), pointsWarning } : populated);
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── CANCEL INVOICE ──────────────────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: 'Mã hóa đơn không hợp lệ' });

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    if (!canModify(req, invoice)) {
      return res.status(403).json({ message: 'Bạn không có quyền hủy hóa đơn này' });
    }
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
// Returns { items, total } — `total` lets the UI say "hiển thị 200/634" instead
// of silently truncating a busy month's report.
router.get('/', async (req, res) => {
  try {
    const { status, employeeId, date, dateFrom, dateTo, paymentMethod } = req.query;
    const filter = { ...visibilityFilter(req) };

    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (employeeId && isValidId(employeeId)) filter.employeeId = oid(employeeId);

    const from = vnStartOfDay(date || dateFrom);
    const to = vnEndOfDay(date || dateTo || dateFrom);
    if (from || to) {
      const range = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      // Settled invoices belong to the day the money came in; anything still
      // open belongs to the day it was written.
      filter.$and = [{ $or: [{ paidAt: range }, { paidAt: null, createdAt: range }] }];
    }

    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || MAX_PAGE_SIZE));
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    const [items, total] = await Promise.all([
      Invoice.find(filter).populate(POPULATE_LIST).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);

    res.json({ items, total, limit, skip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── AGGREGATED REPORT ───────────────────────────────────────────────────────
// Computed in MongoDB so the figures stay correct regardless of page size.
// IMPORTANT: registered before /:id so "stats" is not parsed as an id.
router.get('/stats/summary', async (req, res) => {
  try {
    const { employeeId, paymentMethod } = req.query;
    const today = vnToday();
    const from = vnStartOfDay(req.query.dateFrom || today);
    const to = vnEndOfDay(req.query.dateTo || req.query.dateFrom || today);

    const scope = visibilityFilter(req);
    const extra = {};
    if (employeeId && isValidId(employeeId)) extra.employeeId = oid(employeeId);
    if (paymentMethod) extra.paymentMethod = paymentMethod;

    const paidMatch = { ...scope, ...extra, status: 'paid', paidAt: { $gte: from, $lte: to } };

    const sumIf = (method) => ({
      $sum: { $cond: [{ $eq: ['$paymentMethod', method] }, '$totalAmount', 0] },
    });
    const lineQty = { $ifNull: ['$services.quantity', 1] };

    const [facets] = await Invoice.aggregate([
      { $match: paidMatch },
      {
        $facet: {
          totals: [{
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalAmount' },
              cashRevenue: sumIf('cash'),
              bankRevenue: sumIf('bank'),
              totalPoints: { $sum: '$pointsEarned' },
              paidCount: { $sum: 1 },
            },
          }],
          byEmployee: [
            {
              $group: {
                _id: '$employeeId',
                amount: { $sum: '$totalAmount' },
                cash: sumIf('cash'),
                bank: sumIf('bank'),
                count: { $sum: 1 },
              },
            },
            {
              $lookup: {
                from: 'employees',
                localField: '_id',
                foreignField: '_id',
                as: 'employee',
                pipeline: [{ $project: { name: 1, avatar: 1 } }],
              },
            },
            { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                name: { $ifNull: ['$employee.name', 'Khác'] },
                avatar: { $ifNull: ['$employee.avatar', ''] },
                amount: 1, cash: 1, bank: 1, count: 1,
              },
            },
            { $sort: { amount: -1 } },
          ],
          byService: [
            { $unwind: '$services' },
            {
              $group: {
                _id: '$services.name',
                count: { $sum: lineQty },
                revenue: { $sum: { $multiply: ['$services.price', lineQty] } },
              },
            },
            { $project: { _id: 0, name: '$_id', count: 1, revenue: 1 } },
            { $sort: { revenue: -1 } },
            { $limit: 30 },
          ],
        },
      },
    ]);

    const totals = facets?.totals?.[0] || {
      totalRevenue: 0, cashRevenue: 0, bankRevenue: 0, totalPoints: 0, paidCount: 0,
    };

    // Unsettled invoices have no paidAt, so they are counted by creation date.
    const openRange = { ...scope, createdAt: { $gte: from, $lte: to } };
    const [draftCount, cancelledCount] = await Promise.all([
      Invoice.countDocuments({ ...openRange, status: 'draft' }),
      Invoice.countDocuments({ ...openRange, status: 'cancelled' }),
    ]);

    res.json({
      dateFrom: req.query.dateFrom || today,
      dateTo: req.query.dateTo || req.query.dateFrom || today,
      scope: isAdmin(req) ? 'all' : 'self',
      ...totals,
      avgTicket: totals.paidCount > 0 ? Math.round(totals.totalRevenue / totals.paidCount) : 0,
      draftCount,
      cancelledCount,
      employeeStats: facets?.byEmployee || [],
      serviceStats: facets?.byService || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET SINGLE INVOICE ──────────────────────────────────────────────────────
// Must come after every literal path above.
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: 'Mã hóa đơn không hợp lệ' });

  try {
    const invoice = await Invoice.findOne({ _id: id, ...visibilityFilter(req) })
      .populate('employeeId', 'name avatar')
      .populate('bankAccountId', 'bankName accountNumber accountHolder bankId displayName qrImageBase64');
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
