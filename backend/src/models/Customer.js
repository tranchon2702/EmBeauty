import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  points: {
    type: Number,
    default: 0 // Điểm khả dụng có thể tiêu/đổi quà
  },
  totalPointsEarned: {
    type: Number,
    default: 0 // Tổng điểm tích lũy trọn đời (xác định HẠNG THẺ — không tụt khi tiêu điểm)
  },
  // Stamped on every paid invoice — powers "khách lâu chưa quay lại" lists.
  lastVisitAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
