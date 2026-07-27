import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  pin: {
    type: String,
    required: true // 4-digit code, stored as bcrypt hash
  },
  mustChangePin: {
    type: Boolean,
    default: false // true when admin resets PIN → force change on next login
  },
  role: {
    type: String,
    enum: ['staff', 'admin'],
    default: 'staff'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  avatar: {
    type: String,
    default: '' // Base64 encoded image or URL
  },
  bio: {
    type: String,
    default: '' // Short description e.g. specialties
  }
}, {
  timestamps: true
});

// ─── Pre-save: Auto-hash PIN when created or modified ─────────────────────────
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Method: Compare raw PIN against stored hash ──────────────────────────────
employeeSchema.methods.comparePin = async function (rawPin) {
  return bcrypt.compare(rawPin, this.pin);
};

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
