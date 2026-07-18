import express from 'express';
import Settings from '../models/Settings.js';

const router = express.Router();

// Get settings (exclude sensitive bot token from general access in the future)
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update settings
router.put('/', async (req, res) => {
  const {
    pointRewardRate,
    telegramBotToken,
    telegramChatId,
    telegramNotificationsEnabled,
    salonName,
    salonPhone,
    welcomeMessages
  } = req.body;

  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (pointRewardRate !== undefined) settings.pointRewardRate = Number(pointRewardRate);
    if (telegramBotToken !== undefined) settings.telegramBotToken = telegramBotToken.trim();
    if (telegramChatId !== undefined) settings.telegramChatId = telegramChatId.trim();
    if (telegramNotificationsEnabled !== undefined) settings.telegramNotificationsEnabled = Boolean(telegramNotificationsEnabled);
    if (salonName !== undefined) settings.salonName = salonName.trim();
    if (salonPhone !== undefined) settings.salonPhone = salonPhone.trim();
    if (welcomeMessages !== undefined && Array.isArray(welcomeMessages)) {
      settings.welcomeMessages = welcomeMessages.filter(m => typeof m === 'string' && m.trim());
    }

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Test Telegram connection
router.post('/telegram-test', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return res.status(400).json({ message: 'Chưa cấu hình Telegram Bot Token và Chat ID' });
    }

    const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        text: `✅ <b>EM Beauty Nails & Makeup — Kết nối Telegram thành công!</b>\n\nHệ thống sẽ tự động thông báo khi có lịch hẹn mới.`,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    if (data.ok) {
      res.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công!' });
    } else {
      res.status(400).json({ success: false, message: `Telegram API lỗi: ${data.description}` });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
