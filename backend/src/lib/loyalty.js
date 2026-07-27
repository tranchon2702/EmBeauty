/**
 * Membership tiers are driven by `totalPointsEarned` (lifetime), never by the
 * spendable `points` balance — so redeeming points can never demote a customer.
 */
const TIER_META = [
  { key: 'bronze', name: 'Đồng', icon: '🥉' },
  { key: 'silver', name: 'Bạc', icon: '🥈' },
  { key: 'gold', name: 'Vàng', icon: '🥇' },
  { key: 'diamond', name: 'Kim Cương', icon: '💎' },
];

const DEFAULT_THRESHOLDS = { silver: 50, gold: 100, diamond: 200 };

const thresholdsFrom = (rankSettings = {}) => ({
  bronze: 0,
  silver: Number(rankSettings.silverMinPoints) || DEFAULT_THRESHOLDS.silver,
  gold: Number(rankSettings.goldMinPoints) || DEFAULT_THRESHOLDS.gold,
  diamond: Number(rankSettings.diamondMinPoints) || DEFAULT_THRESHOLDS.diamond,
});

/**
 * @param {number} lifetimePoints  Customer.totalPointsEarned
 * @param {object} rankSettings    Settings.rankSettings
 * @returns tier the customer holds, plus how far the next one is.
 */
export const resolveRank = (lifetimePoints, rankSettings = {}) => {
  const points = Math.max(0, Number(lifetimePoints) || 0);
  const thresholds = thresholdsFrom(rankSettings);

  const tiers = TIER_META.map((tier) => ({
    ...tier,
    minPoints: thresholds[tier.key],
    benefits: Array.isArray(rankSettings[`${tier.key}Benefits`])
      ? rankSettings[`${tier.key}Benefits`]
      : [],
  }));

  // Highest tier whose threshold the customer has cleared.
  let currentIndex = 0;
  for (let i = tiers.length - 1; i >= 0; i -= 1) {
    if (points >= tiers[i].minPoints) { currentIndex = i; break; }
  }

  const current = tiers[currentIndex];
  const next = tiers[currentIndex + 1] || null;
  const span = next ? next.minPoints - current.minPoints : 0;

  return {
    key: current.key,
    name: current.name,
    icon: current.icon,
    minPoints: current.minPoints,
    benefits: current.benefits,
    lifetimePoints: points,
    next: next
      ? {
        key: next.key,
        name: next.name,
        icon: next.icon,
        minPoints: next.minPoints,
        pointsNeeded: Math.max(0, next.minPoints - points),
        // 0–100, how far along the customer is between the two thresholds.
        progressPercent: span > 0
          ? Math.min(100, Math.round(((points - current.minPoints) / span) * 100))
          : 100,
      }
      : null,
    allTiers: tiers.map(({ key, name, icon, minPoints, benefits }) => ({
      key, name, icon, minPoints, benefits,
    })),
  };
};
