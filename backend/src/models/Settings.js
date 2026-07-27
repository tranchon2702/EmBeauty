import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Points awarded = floor(totalAmount * pointRewardRate / 100000).
  // At the default of 10 that is 1 point per 10.000đ spent.
  pointRewardRate: {
    type: Number,
    default: 10
  },
  // Salon info
  salonName: {
    type: String,
    default: 'EM Beauty'
  },
  salonPhone: {
    type: String,
    default: '035 836 7919'
  },
  salonAddress: {
    type: String,
    default: '64 Linh Trung, Linh Xuân, TP.HCM'
  },
  salonHours: {
    type: String,
    default: '08:00 - 20:30'
  },
  googleMapsUrl: {
    type: String,
    default: 'https://maps.app.goo.gl/DruZXXTrtSVBj6LW9'
  },
  facebookUrl: {
    type: String,
    default: 'https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN'
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
  },
  // Loyalty rank tier thresholds & custom benefits
  rankSettings: {
    silverMinPoints: { type: Number, default: 50 },
    goldMinPoints: { type: Number, default: 100 },
    diamondMinPoints: { type: Number, default: 200 },
    bronzeBenefits: {
      type: [String],
      default: [
        'Tích điểm tự động mỗi lần làm dịch vụ',
        'Quà chào mừng dành riêng cho thành viên mới',
        'Tra cứu điểm trực tuyến mọi lúc qua Zalo/Web'
      ]
    },
    silverBenefits: {
      type: [String],
      default: [
        'Tích điểm mỗi lần sử dụng dịch vụ',
        'Giảm 5% trực tiếp trên hóa đơn dịch vụ Nails',
        'Quà ưu đãi sinh nhật đặc biệt trong tháng'
      ]
    },
    goldBenefits: {
      type: [String],
      default: [
        'Tích điểm ×1.5 tốc độ mỗi hóa đơn',
        'Giảm 10% tất cả dịch vụ (Nails, Mi, Gội đầu, Makeup)',
        'Quà sinh nhật cao cấp + quà tặng kỷ niệm',
        'Ưu tiên giữ lịch hẹn đẹp qua Zalo'
      ]
    },
    diamondBenefits: {
      type: [String],
      default: [
        'Tích điểm ×2 nhân đôi tốc độ mỗi hóa đơn',
        'Giảm 15% trọn đời tất cả dịch vụ tại tiệm',
        'Combo quà sinh nhật VIP + 1 dịch vụ chăm sóc miễn phí',
        'Ưu tiên tuyệt đối đặt lịch & tư vấn mẫu móng riêng',
        'Thẻ mời tham gia sự kiện Tri Ân đặc quyền'
      ]
    }
  },
  // One-off data fixes that have already run, so boot stays idempotent.
  migrations: {
    lifetimePointsBackfill: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
