import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  pointRewardRate: {
    type: Number,
    default: 10 // e.g. 10% of total invoice value converted to loyalty points
  },
  // Telegram Bot integration
  telegramBotToken: {
    type: String,
    default: '' // e.g. "123456789:ABCdef..."
  },
  telegramChatId: {
    type: String,
    default: '' // Admin's Telegram chat ID or group ID
  },
  telegramNotificationsEnabled: {
    type: Boolean,
    default: false
  },
  // Salon info
  salonName: {
    type: String,
    default: 'EM Beauty Nails & Makeup'
  },
  salonPhone: {
    type: String,
    default: '035 836 7919'
  },
  // Gen-Z rotating welcome messages on homepage
  welcomeMessages: {
    type: [String],
    default: [
      'Cảm ơn bạn đã ghé thăm EM Beauty ✨',
      'Móng đẹp là vũ khí — em lo hết cho bạn nha',
      'Nails chuẩn · Mi cong · Makeup xịn · Bạn xinh',
      'Vào đây thì phải ra về xinh hơn lúc đến 💕',
      'Hôm nay bạn muốn biến hình kiểu gì?',
      'Vẻ đẹp hoàn hảo từ ngón tay đến khuôn mặt',
      'EM Beauty — nơi mỗi chi tiết đều được chăm chút',
      'Xinh hay không? Hãy để EM Beauty quyết định ✨',
      'Mỗi lần ra về, bạn sẽ mốt hơn lúc vào 💅',
      'Nail xong rồi selfie thôi, chính sách!',
      'Tiệm nhỏ nhưng tâm rất lớn — em hứa 🤍'
    ]
  }
}, {
  timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
