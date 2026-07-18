import mongoose from 'mongoose';

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
    required: true // 4-digit code e.g. "1234"
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

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
