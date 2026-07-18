import cron from 'node-cron';
import Booking from '../models/Booking.js';
import Settings from '../models/Settings.js';

// ─── TELEGRAM HELPER ──────────────────────────────────────────────────────────
const sendTelegram = async (message) => {
  try {
    const settings = await Settings.findOne();
    if (!settings?.telegramNotificationsEnabled || !settings?.telegramBotToken || !settings?.telegramChatId) return;
    await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: settings.telegramChatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.warn('[Cron] Telegram failed:', err.message);
  }
};

// ─── DAILY REMINDER — Mỗi ngày 8:00 SA (GMT+7 = 01:00 UTC) ──────────────────
// Gửi danh sách lịch hẹn ngày hôm nay + ngày mai
export const startCronJobs = () => {
  // Chạy lúc 8:00 SA giờ VN (UTC+7 → 01:00 UTC)
  cron.schedule('0 1 * * *', async () => {
    console.log('[Cron] Đang gửi nhắc lịch hàng ngày...');
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

      const tomorrowStart = new Date(now); tomorrowStart.setDate(now.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd   = new Date(now); tomorrowEnd.setDate(now.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);

      const [todayBookings, tomorrowBookings] = await Promise.all([
        Booking.find({ status: { $in: ['pending', 'confirmed'] }, date: { $gte: todayStart, $lte: todayEnd } }).sort({ time: 1 }),
        Booking.find({ status: { $in: ['pending', 'confirmed'] }, date: { $gte: tomorrowStart, $lte: tomorrowEnd } }).sort({ time: 1 }),
      ]);

      // Format danh sách
      const formatList = (list) => {
        if (!list.length) return '  <i>Không có lịch hẹn nào</i>';
        return list.map((b, i) =>
          `  ${i + 1}. <b>${b.time}</b> — ${b.name}` +
          (b.services?.length ? ` (${b.services.slice(0, 2).join(', ')})` : '') +
          (b.status === 'pending' ? ' ⏳' : ' ✅')
        ).join('\n');
      };

      const todayDate = todayStart.toLocaleDateString('vi-VN');
      const tomorrowDate = tomorrowStart.toLocaleDateString('vi-VN');

      const message =
        `🌸 <b>EM Beauty — Lịch hẹn hôm nay (${todayDate})</b>\n` +
        formatList(todayBookings) +
        `\n\n📋 <b>Ngày mai (${tomorrowDate})</b>\n` +
        formatList(tomorrowBookings) +
        `\n\n💪 Chúc các bạn một ngày làm việc hiệu quả!`;

      await sendTelegram(message);
      console.log('[Cron] Đã gửi nhắc lịch thành công');
    } catch (err) {
      console.error('[Cron] Lỗi gửi nhắc lịch:', err.message);
    }
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log('[Cron] Đã khởi động job nhắc lịch hàng ngày lúc 08:00 SA (VN)');
};
