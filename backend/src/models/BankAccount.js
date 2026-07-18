import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
  // VietQR API identifier (e.g. "mbbank", "vietcombank")
  bankId: {
    type: String,
    required: true
  },
  // Human-readable bank name (e.g. "MB Bank", "Vietcombank")
  bankName: {
    type: String,
    required: true
  },
  // Account number
  accountNumber: {
    type: String,
    required: true
  },
  // Account holder name (uppercase, no diacritics per bank format)
  accountHolder: {
    type: String,
    required: true
  },
  // Short display label shown in dropdowns e.g. "MB Bank (Quỳnh Như)"
  displayName: {
    type: String,
    required: true
  },
  // Optional: static QR image uploaded by admin (Base64). If present, use instead of VietQR API.
  qrImageBase64: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
export default BankAccount;
