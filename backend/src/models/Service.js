import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0 // 0 is valid — complimentary / promotional items
  },
  // Matches Category.key
  category: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  // Master switch — false hides the service everywhere.
  isActive: {
    type: Boolean,
    default: true
  },
  // Show on the customer-facing price list (/about page).
  showOnMenu: {
    type: Boolean,
    default: true
  },
  // Show in the staff invoice creation picker.
  showInInvoice: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Service = mongoose.model('Service', serviceSchema);
export default Service;
