import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerPhone: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    default: ''
  },
  // The technician credited with the work — drives the performance report.
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  // Every technician who worked on the bill. `employeeId` remains the primary
  // technician for backwards compatibility with invoices created before this
  // multi-technician field existed.
  employeeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  // Who actually rang the invoice up. Staff may only edit their own; admins any.
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    index: true
  },
  services: [
    {
      // Optional catalog link. Name and price remain snapshots so editing or
      // deleting the catalog service never rewrites a historical invoice.
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null
      },
      name: { type: String, required: true },
      // Reference/quoted price for this invoice. It starts from the catalog but
      // may move up when a custom quote is entered, allowing a later reduction
      // to be displayed clearly (for example 600k struck through to 500k).
      catalogPrice: { type: Number, default: null },
      // Actual unit price charged on this invoice (customizable up or down).
      price: { type: Number, required: true },
      quantity: { type: Number, default: 1 },
      // Which technician performed this specific service line.
      // Null means the primary technician (employeeId) did it.
      employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
      }
    }
  ],
  // Every money field below is recomputed server-side from `services`.
  subTotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  // Raw bill-level discount choice. `discount` above stores the derived VND
  // amount so old reports and totals stay backwards compatible.
  discountType: {
    type: String,
    enum: ['amount', 'percent'],
    default: 'amount'
  },
  discountValue: {
    type: Number,
    default: 0
  },
  surcharge: {
    type: Number,
    default: 0
  },
  surchargeNote: {
    type: String,
    default: '' // e.g. "Phụ thu vẽ nhũ"
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['draft', 'paid', 'cancelled'],
    default: 'draft',
    index: true
  },
  // Set the moment payment is confirmed. All revenue reporting keys off this.
  paidAt: {
    type: Date,
    default: null,
    index: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    default: null
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  note: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Supports "paid invoices in a date range, optionally per employee".
invoiceSchema.index({ status: 1, paidAt: -1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ employeeIds: 1, paidAt: -1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
