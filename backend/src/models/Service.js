import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    // nails = nail services
    // eyelashes = lash extensions (Nối mi)
    // washing = hair wash & massage (Gội đầu)
    // makeup = makeup services
    enum: ['nails', 'eyelashes', 'washing', 'makeup'],
    required: true
  },
  duration: {
    type: Number,
    default: 60 // duration in minutes, used for booking conflict check
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Service = mongoose.model('Service', serviceSchema);
export default Service;
