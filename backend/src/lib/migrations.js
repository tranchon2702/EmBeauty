import Customer from '../models/Customer.js';
import { getSettings } from '../routes/settings.js';

/**
 * One-off data fixes, guarded by a flag on the settings document so the boot
 * path stays idempotent across restarts and redeploys.
 */
export const runStartupMigrations = async () => {
  const settings = await getSettings();
  if (!settings.migrations) settings.migrations = {};

  // Membership tiers read `totalPointsEarned`, which was added after the first
  // customers already had a balance — those records would otherwise all sit at
  // 0 lifetime points and be ranked as brand-new members.
  if (!settings.migrations.lifetimePointsBackfill) {
    const result = await Customer.updateMany(
      { $expr: { $lt: [{ $ifNull: ['$totalPointsEarned', 0] }, '$points'] } },
      [{ $set: { totalPointsEarned: '$points' } }]
    );
    if (result.modifiedCount > 0) {
      console.log(`Migration: backfilled lifetime points for ${result.modifiedCount} customer(s).`);
    }
    settings.migrations.lifetimePointsBackfill = true;
    await settings.save();
  }
};
