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
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  services: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, default: 1 }
    }
  ],
  discount: {
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
    enum: ['cash', 'bank', 'mixed'],
    default: 'cash'
  },
  // Payment status lifecycle: draft → pending_payment → paid
  status: {
    type: String,
    enum: ['draft', 'pending_payment', 'paid', 'cancelled'],
    default: 'draft'
  },
  paidAt: {
    type: Date,
    default: null
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

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
