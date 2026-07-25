import express from 'express';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// ─── TELEGRAM NOTIFICATION HELPER ────────────────────────────────────────────
const sendTelegramNotification = async (message) => {
  try {
    const settings = await Settings.findOne();
    if (!settings?.telegramNotificationsEnabled || !settings?.telegramBotToken || !settings?.telegramChatId) {
      return; // Telegram not configured or disabled
    }
    const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.warn('Telegram notification failed (non-critical):', err.message);
  }
};

// ─── BOOKING CONFLICT CHECK ───────────────────────────────────────────────────
const checkConflict = async (date, time, services, ignoreBookingId = null) => {
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  const start = new Date(year, month - 1, day, hour, minute, 0);

  const dbServices = await Service.find({ name: { $in: services } });
  const duration = dbServices.reduce((sum, s) => sum + (s.duration || 60), 0) || 60;
  const end = new Date(start.getTime() + duration * 60000);

  const hasNail = dbServices.some(s => s.category === 'nails' || s.category === 'eyelashes');
  const hasMakeup = dbServices.some(s => s.category === 'makeup');

  const prevDay = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const activeBookings = await Booking.find({
    status: { $in: ['pending', 'confirmed'] },
    date: { $gte: prevDay, $lte: nextDay },
    _id: { $ne: ignoreBookingId }
  });

  const intervals = [{
    id: 'proposed',
    start: start.getTime(),
    end: end.getTime(),
    hasNail,
    hasMakeup
  }];

  for (const b of activeBookings) {
    const bDateStr = b.date.toISOString().split('T')[0];
    const [bYear, bMonth, bDay] = bDateStr.split('-');
    const [bHour, bMinute] = b.time.split(':');
    const bStart = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, 0);

    const bDbServices = await Service.find({ name: { $in: b.services } });
    const bDuration = bDbServices.reduce((sum, s) => sum + (s.duration || 60), 0) || 60;
    const bEnd = new Date(bStart.getTime() + bDuration * 60000);

    if (bStart.getTime() < end.getTime() && start.getTime() < bEnd.getTime()) {
      intervals.push({
        id: b._id.toString(),
        start: bStart.getTime(),
        end: bEnd.getTime(),
        hasNail: bDbServices.some(s => s.category === 'nails' || s.category === 'eyelashes'),
        hasMakeup: bDbServices.some(s => s.category === 'makeup')
      });
    }
  }

  const timePointsSet = new Set();
  timePointsSet.add(start.getTime());
  timePointsSet.add(end.getTime());
  intervals.forEach(inv => {
    if (inv.start > start.getTime() && inv.start < end.getTime()) timePointsSet.add(inv.start);
    if (inv.end > start.getTime() && inv.end < end.getTime()) timePointsSet.add(inv.end);
  });

  const timePoints = Array.from(timePointsSet).sort((a, b) => a - b);

  for (let i = 0; i < timePoints.length - 1; i++) {
    const tStart = timePoints[i];
    const tEnd = timePoints[i + 1];
    const mid = (tStart + tEnd) / 2;

    let concurrentTotal = 0;
    let concurrentNails = 0;
    let concurrentMakeup = 0;

    intervals.forEach(inv => {
      if (inv.start < mid && mid < inv.end) {
        concurrentTotal++;
        if (inv.hasNail) concurrentNails++;
        if (inv.hasMakeup) concurrentMakeup++;
      }
    });

    if (concurrentTotal > 3) {
      return { conflict: true, message: 'Khung giờ này đã đạt giới hạn tối đa 3 khách. Vui lòng chọn khung giờ khác.' };
    }
    if (concurrentNails > 2) {
      return { conflict: true, message: 'Khung giờ này đã đủ 2 khách làm Nails/Mi. Vui lòng chọn giờ khác.' };
    }
    if (concurrentMakeup > 1) {
      return { conflict: true, message: 'Khung giờ này đã có khách làm Makeup. Vui lòng chọn giờ khác.' };
    }
  }

  return { conflict: false };
};

// ─── CREATE BOOKING ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, phone, services, date, time, note, status } = req.body;

  if (!name || !phone || !date || !time) {
    return res.status(400).json({ message: 'Họ tên, số điện thoại, ngày và giờ là bắt buộc' });
  }

  try {
    const validation = await checkConflict(date, time, services || []);
    if (validation.conflict) {
      return res.status(400).json({ message: validation.message });
    }

    const booking = new Booking({
      name: name.trim(),
      phone: phone.trim(),
      services: services || [],
      date: new Date(date),
      time: time.trim(),
      note: note || '',
      status: status || 'pending'
    });

    await booking.save();

    // Send Telegram notification for customer online bookings (not walk-ins)
    if (status !== 'confirmed') {
      const dateFormatted = new Date(date).toLocaleDateString('vi-VN');
      const servicesList = services?.length > 0 ? services.join(', ') : 'Chưa chọn dịch vụ';
      const message = `📅 <b>Lịch hẹn mới từ website!</b>\n\n👤 Khách: <b>${name}</b>\n📞 SĐT: <b>${phone}</b>\n🕐 Ngày: <b>${dateFormatted}</b> lúc <b>${time}</b>\n💅 Dịch vụ: ${servicesList}${note ? `\n📝 Ghi chú: ${note}` : ''}\n\n➡️ Vào hệ thống nội bộ để xác nhận lịch!`;
      await sendTelegramNotification(message);
    }

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET BOOKINGS ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    const bookings = await Booking.find(filter).sort({ date: 1, time: 1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Giá trị trạng thái không hợp lệ' });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = status;
    await booking.save();

    // Notify on confirmation
    if (status === 'confirmed') {
      const dateFormatted = booking.date.toLocaleDateString('vi-VN');
      const message = `✅ <b>Lịch hẹn đã được xác nhận!</b>\n\n👤 Khách: <b>${booking.name}</b>\n📞 SĐT: <b>${booking.phone}</b>\n🕐 Ngày: <b>${dateFormatted}</b> lúc <b>${booking.time}</b>`;
      await sendTelegramNotification(message);
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
