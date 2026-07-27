import express from 'express';
import Settings from '../models/Settings.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/** There is exactly one settings document; create it lazily on first read. */
export const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) settings = await new Settings().save();
  return settings;
};

const cleanList = (value) =>
  Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : null;

// ─── PUBLIC: salon info, welcome messages and loyalty tiers ──────────────────
// Everything stored here is customer-facing by design (the homepage, the price
// list and the membership card all read it), so nothing needs masking.
router.get('/', async (req, res) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: update settings ──────────────────────────────────────────────────
router.put('/', requireAdmin, async (req, res) => {
  const {
    pointRewardRate, salonName, salonPhone, salonAddress,
    salonHours, googleMapsUrl, facebookUrl, welcomeMessages, rankSettings,
  } = req.body;

  try {
    const settings = await getSettings();

    if (pointRewardRate !== undefined) {
      const rate = Number(pointRewardRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ message: 'Tỉ lệ tích điểm phải nằm trong khoảng 0 – 100' });
      }
      settings.pointRewardRate = rate;
    }

    const text = { salonName, salonPhone, salonAddress, salonHours, googleMapsUrl, facebookUrl };
    for (const [key, value] of Object.entries(text)) {
      if (value !== undefined) settings[key] = String(value).trim();
    }

    const messages = cleanList(welcomeMessages);
    if (messages) settings.welcomeMessages = messages;

    if (rankSettings) {
      if (!settings.rankSettings) settings.rankSettings = {};
      const target = settings.rankSettings;

      const silver = rankSettings.silverMinPoints !== undefined
        ? Number(rankSettings.silverMinPoints) : target.silverMinPoints;
      const gold = rankSettings.goldMinPoints !== undefined
        ? Number(rankSettings.goldMinPoints) : target.goldMinPoints;
      const diamond = rankSettings.diamondMinPoints !== undefined
        ? Number(rankSettings.diamondMinPoints) : target.diamondMinPoints;

      if (![silver, gold, diamond].every((n) => Number.isFinite(n) && n >= 0)) {
        return res.status(400).json({ message: 'Mốc điểm các hạng thẻ phải là số không âm' });
      }
      // Out-of-order thresholds would make a tier unreachable.
      if (!(silver < gold && gold < diamond)) {
        return res.status(400).json({
          message: `Mốc điểm phải tăng dần: Bạc (${silver}) < Vàng (${gold}) < Kim Cương (${diamond})`,
        });
      }
      target.silverMinPoints = silver;
      target.goldMinPoints = gold;
      target.diamondMinPoints = diamond;

      for (const tier of ['bronze', 'silver', 'gold', 'diamond']) {
        const benefits = cleanList(rankSettings[`${tier}Benefits`]);
        if (benefits) target[`${tier}Benefits`] = benefits;
      }
    }

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
