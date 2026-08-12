import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Settings from '../models/Settings.js';
import Employee from '../models/Employee.js';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { computeInvoiceTotals } from '../lib/invoiceTotals.js';
import { vnToday, vnStartOfDay, vnEndOfDay, vnDateCompact } from '../lib/time.js';

const router = express.Router();

// All invoice routes require authentication
router.use(requireAuth);

const MAX_PAGE_SIZE = 200;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const oid = (id) => new mongoose.Types.ObjectId(id);

const normalizeEmployeeIds = (employeeIds, employeeId, services) => {
  // Always keep the primary worker first. Previously a non-empty employeeIds
  // array could silently replace employeeId with whichever service worker was
  // listed first, making A's bill become B's bill.
  const candidates = [employeeId, ...(Array.isArray(employeeIds) ? employeeIds : [])];

  // Also collect any per-service employee assignments.
  const perServiceIds = Array.isArray(services)
    ? services.map(s => s?.employeeId).filter(Boolean)
    : [];

  return [...new Set(
    [...candidates, ...perServiceIds]
      .map((id) => String(id || ''))
      .filter(isValidId)
  )];
};

const assertActiveWorkers = async (workerIds) => {
  const count = await Employee.countDocuments({
    _id: { $in: workerIds },
    status: 'active',
  });
  if (count !== workerIds.length) {
    throw new Error('Có nhân viên không tồn tại hoặc đã ngừng hoạt động');
  }
};

const assignMissingLineWorkers = (services, fallbackEmployeeId) =>
  services.map((service) => ({
    ...service,
    employeeId: service.employeeId || fallbackEmployeeId,
  }));

const employeeMatch = (employeeId) => {
  const id = oid(employeeId);
  return { $or: [{ employeeId: id }, { employeeIds: id }] };
};

/**
 * Staff only ever see invoices they rang up or performed; admins see everything.
 * `createdBy` is absent on invoices written before it existed, hence the $or.
 */
const visibilityFilter = (req) => {
  if (isAdmin(req)) return {};
  const me = oid(req.user.id);
  return { $or: [{ createdBy: me }, { employeeId: me }, { employeeIds: me }] };
};

const canModify = (req, invoice) =>
  isAdmin(req) ||
  invoice.createdBy?.toString() === req.user.id ||
  invoice.employeeId?.toString() === req.user.id ||
  invoice.employeeIds?.some((id) => id.toString() === req.user.id);

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
  { path: 'employeeIds', select: 'name avatar' },
  { path: 'bankAccountId', select: 'accountType bankId bankName accountNumber displayName' },
  { path: 'services.employeeId', select: 'name avatar' },
];

// ─── CREATE DRAFT INVOICE ────────────────────────────────────────────────────
// Money is always derived from the line items — see lib/invoiceTotals.js.
router.post('/', async (req, res) => {
  const {
    customerPhone, customerName, employeeId, employeeIds, services,
    discount, discountType, discountValue, surcharge, surchargeNote, paymentMethod, bankAccountId, note,
  } = req.body;

  let totals;
  try {
    totals = computeInvoiceTotals({ services, discount, discountType, discountValue, surcharge });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  // A staff-created invoice belongs to the signed-in staff member. Admins may
  // still explicitly create one on behalf of another employee.
  const primaryEmployeeId = isAdmin(req) && isValidId(employeeId)
    ? String(employeeId)
    : req.user.id;
  let workers = normalizeEmployeeIds(employeeIds, primaryEmployeeId, totals.services);
  if (workers.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn ít nhất một thợ thực hiện' });
  }

  totals.services = assignMissingLineWorkers(totals.services, workers[0]);
  workers = normalizeEmployeeIds(workers, workers[0], totals.services);
  try {
    await assertActiveWorkers(workers);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const base = {
    customerPhone: (customerPhone || '').trim(),
    customerName: (customerName || '').trim(),
    employeeId: workers[0],
    employeeIds: workers,
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
    services, discount, discountType, discountValue, surcharge, surchargeNote,
    paymentMethod, bankAccountId, note, customerPhone, customerName, employeeId, employeeIds,
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
        discountType: discountType !== undefined ? discountType : invoice.discountType,
        discountValue: discountValue !== undefined
          ? discountValue
          : discount !== undefined
            ? discount
            : invoice.discountType === 'percent'
              ? invoice.discountValue
              : invoice.discountValue || invoice.discount,
        surcharge: surcharge !== undefined ? surcharge : invoice.surcharge,
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
    if (employeeIds !== undefined || employeeId !== undefined || services !== undefined) {
      const requestedEmployeeIds = employeeIds !== undefined ? employeeIds : invoice.employeeIds;
      // Staff cannot accidentally transfer ownership while editing a draft.
      // If this is an older draft created before ownership was enforced, its
      // creator is corrected to primary on the next edit. An admin can still
      // intentionally change the primary employee.
      const requestedPrimary = isAdmin(req) && employeeId !== undefined
        ? employeeId
        : invoice.createdBy?.toString() === req.user.id
          ? req.user.id
          : invoice.employeeId;
      let workers = normalizeEmployeeIds(requestedEmployeeIds, requestedPrimary, totals.services);
      if (workers.length === 0) {
        return res.status(400).json({ message: 'Vui lòng chọn ít nhất một thợ thực hiện' });
      }
      totals.services = assignMissingLineWorkers(totals.services, workers[0]);
      workers = normalizeEmployeeIds(workers, workers[0], totals.services);
      try {
        await assertActiveWorkers(workers);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
      invoice.employeeId = workers[0];
      invoice.employeeIds = workers;
    }
    Object.assign(invoice, totals);
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

// ─── DELETE INVOICE (OWNER ONLY) ─────────────────────────────────────────────
// Hard deletion is intentionally reserved for admins because the owner uses it
// to remove a wrongly-entered bill before staff create the corrected bill.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: 'Mã hóa đơn không hợp lệ' });
  if (!isAdmin(req)) {
    return res.status(403).json({ message: 'Chỉ chủ tiệm mới có quyền xóa hóa đơn' });
  }

  try {
    const invoice = await Invoice.findByIdAndDelete(id);
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    res.json({ message: `Đã xóa hóa đơn ${invoice.invoiceNumber}` });
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
    const clauses = [visibilityFilter(req)];

    if (status) clauses.push({ status });
    if (paymentMethod) clauses.push({ paymentMethod });
    if (employeeId && isValidId(employeeId)) clauses.push(employeeMatch(employeeId));

    const from = vnStartOfDay(date || dateFrom);
    const to = vnEndOfDay(date || dateTo || dateFrom);
    if (from || to) {
      const range = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      // Settled invoices belong to the day the money came in; anything still
      // open belongs to the day it was written.
      clauses.push({ $or: [{ paidAt: range }, { paidAt: null, createdAt: range }] });
    }

    const activeClauses = clauses.filter((clause) => Object.keys(clause).length > 0);
    const filter = activeClauses.length > 1 ? { $and: activeClauses } : (activeClauses[0] || {});

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

    const commonClauses = [visibilityFilter(req)];
    if (employeeId && isValidId(employeeId)) commonClauses.push(employeeMatch(employeeId));
    if (paymentMethod) commonClauses.push({ paymentMethod });

    const paidMatch = {
      $and: [...commonClauses, { status: 'paid', paidAt: { $gte: from, $lte: to } }],
    };

    const sumIf = (method) => ({
      $sum: { $cond: [{ $eq: ['$paymentMethod', method] }, '$totalAmount', 0] },
    });
    // When a report is scoped to one employee, service figures must include
    // only the lines that employee actually performed — not every line on a
    // multi-technician invoice. Legacy lines fall back to the primary worker.
    const lineEmployeeScope = employeeId && isValidId(employeeId)
      ? oid(employeeId)
      : (!isAdmin(req) ? oid(req.user.id) : null);
    const serviceLineStages = [
      { $unwind: '$services' },
      {
        $set: {
          effectiveLineEmployeeId: { $ifNull: ['$services.employeeId', '$employeeId'] },
          lineQty: { $ifNull: ['$services.quantity', 1] },
          lineRevenue: {
            $multiply: ['$services.price', { $ifNull: ['$services.quantity', 1] }],
          },
        },
      },
      ...(lineEmployeeScope ? [{ $match: { effectiveLineEmployeeId: lineEmployeeScope } }] : []),
    ];

    // Attribute the settled bill exactly once across employees:
    // - supporting employees receive the services explicitly assigned to them;
    // - the primary employee receives the remaining bill total, so bill-level
    //   discounts/surcharges stay with the owner instead of being duplicated;
    // - if an unusually large bill discount is lower than supporting services,
    //   the available total is shared proportionally and nobody goes negative.
    const employeeAttributionStages = [
      {
        $set: {
          supportingGross: {
            $reduce: {
              input: { $ifNull: ['$services', []] },
              initialValue: 0,
              in: {
                $let: {
                  vars: {
                    lineEmployeeId: { $ifNull: ['$$this.employeeId', '$employeeId'] },
                    lineGross: {
                      $multiply: [
                        { $ifNull: ['$$this.price', 0] },
                        { $ifNull: ['$$this.quantity', 1] },
                      ],
                    },
                  },
                  in: {
                    $cond: [
                      { $ne: ['$$lineEmployeeId', '$employeeId'] },
                      { $add: ['$$value', '$$lineGross'] },
                      '$$value',
                    ],
                  },
                },
              },
            },
          },
          // The zero-value placeholder guarantees the primary owner still gets
          // a group when every service line was delegated to someone else.
          attributionServices: {
            $concatArrays: [
              { $ifNull: ['$services', []] },
              [{ employeeId: null, price: 0, quantity: 1 }],
            ],
          },
        },
      },
      {
        $set: {
          // Sum the supporting employees after any extreme bill-level discount.
          // Each supporting line is floored to whole VND and the tiny rounding
          // remainder stays with the primary owner, keeping the grand total
          // exact even with several supporting employees.
          supportingAllocatedTotal: {
            $reduce: {
              input: { $ifNull: ['$services', []] },
              initialValue: 0,
              in: {
                $let: {
                  vars: {
                    lineEmployeeId: { $ifNull: ['$$this.employeeId', '$employeeId'] },
                    lineGross: {
                      $multiply: [
                        { $ifNull: ['$$this.price', 0] },
                        { $ifNull: ['$$this.quantity', 1] },
                      ],
                    },
                  },
                  in: {
                    $cond: [
                      { $ne: ['$$lineEmployeeId', '$employeeId'] },
                      {
                        $add: [
                          '$$value',
                          {
                            $cond: [
                              { $gt: ['$supportingGross', '$totalAmount'] },
                              {
                                $floor: {
                                  $multiply: [
                                    '$$lineGross',
                                    { $divide: ['$totalAmount', '$supportingGross'] },
                                  ],
                                },
                              },
                              '$$lineGross',
                            ],
                          },
                        ],
                      },
                      '$$value',
                    ],
                  },
                },
              },
            },
          },
        },
      },
      { $unwind: '$attributionServices' },
      {
        $set: {
          attributionEmployeeId: { $ifNull: ['$attributionServices.employeeId', '$employeeId'] },
          attributionLineAmount: {
            $let: {
              vars: {
                lineEmployeeId: { $ifNull: ['$attributionServices.employeeId', '$employeeId'] },
                lineGross: {
                  $multiply: [
                    { $ifNull: ['$attributionServices.price', 0] },
                    { $ifNull: ['$attributionServices.quantity', 1] },
                  ],
                },
              },
              in: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$$lineEmployeeId', '$employeeId'] },
                      { $gt: ['$supportingGross', '$totalAmount'] },
                    ],
                  },
                  {
                    $floor: {
                      $multiply: [
                        '$$lineGross',
                        { $divide: ['$totalAmount', '$supportingGross'] },
                      ],
                    },
                  },
                  '$$lineGross',
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: { employeeId: '$attributionEmployeeId', invoiceId: '$_id' },
          allocatedLines: { $sum: '$attributionLineAmount' },
          invoiceTotal: { $first: '$totalAmount' },
          supportingAllocatedTotal: { $first: '$supportingAllocatedTotal' },
          primaryEmployeeId: { $first: '$employeeId' },
          paymentMethod: { $first: '$paymentMethod' },
        },
      },
      {
        $set: {
          amount: {
            $cond: [
              { $eq: ['$_id.employeeId', '$primaryEmployeeId'] },
              { $max: [{ $subtract: ['$invoiceTotal', '$supportingAllocatedTotal'] }, 0] },
              '$allocatedLines',
            ],
          },
        },
      },
    ];

    const fullInvoiceTotalsStages = [{
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        cashRevenue: sumIf('cash'),
        bankRevenue: sumIf('bank'),
        totalPoints: { $sum: '$pointsEarned' },
        paidCount: { $sum: 1 },
      },
    }];
    const attributedTotalsStages = [
      ...employeeAttributionStages,
      { $match: { '_id.employeeId': lineEmployeeScope } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          cashRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$amount', 0] },
          },
          bankRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank'] }, '$amount', 0] },
          },
          totalPoints: { $sum: 0 },
          paidCount: { $sum: 1 },
        },
      },
    ];

    const [facets] = await Invoice.aggregate([
      { $match: paidMatch },
      {
        $facet: {
          totals: lineEmployeeScope ? attributedTotalsStages : fullInvoiceTotalsStages,
          byEmployee: [
            ...employeeAttributionStages,
            ...(lineEmployeeScope ? [{ $match: { '_id.employeeId': lineEmployeeScope } }] : []),
            {
              $group: {
                _id: '$_id.employeeId',
                amount: { $sum: '$amount' },
                cash: {
                  $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$amount', 0] },
                },
                bank: {
                  $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank'] }, '$amount', 0] },
                },
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
            ...serviceLineStages,
            {
              $group: {
                _id: '$services.name',
                count: { $sum: '$lineQty' },
                revenue: { $sum: '$lineRevenue' },
              },
            },
            { $project: { _id: 0, name: '$_id', count: 1, revenue: 1 } },
            { $sort: { revenue: -1 } },
            { $limit: 30 },
          ],
          serviceTotals: [
            ...serviceLineStages,
            {
              $group: {
                _id: null,
                serviceCount: { $sum: '$lineQty' },
                serviceRevenue: { $sum: '$lineRevenue' },
              },
            },
          ],
        },
      },
    ]);

    const totals = facets?.totals?.[0] || {
      totalRevenue: 0, cashRevenue: 0, bankRevenue: 0, totalPoints: 0, paidCount: 0,
    };
    const serviceTotals = facets?.serviceTotals?.[0] || { serviceCount: 0, serviceRevenue: 0 };

    // Unsettled invoices have no paidAt, so they are counted by creation date.
    const [draftCount, cancelledCount] = await Promise.all([
      Invoice.countDocuments({
        $and: [...commonClauses, { status: 'draft', createdAt: { $gte: from, $lte: to } }],
      }),
      Invoice.countDocuments({
        $and: [...commonClauses, { status: 'cancelled', createdAt: { $gte: from, $lte: to } }],
      }),
    ]);

    res.json({
      dateFrom: req.query.dateFrom || today,
      dateTo: req.query.dateTo || req.query.dateFrom || today,
      scope: isAdmin(req) ? 'all' : 'self',
      ...totals,
      ...serviceTotals,
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
      .populate('employeeIds', 'name avatar')
      .populate('services.employeeId', 'name avatar')
      .populate('bankAccountId', 'accountType bankName accountNumber accountHolder bankId displayName qrImageBase64');
    if (!invoice) return res.status(404).json({ message: 'Hóa đơn không tồn tại' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
