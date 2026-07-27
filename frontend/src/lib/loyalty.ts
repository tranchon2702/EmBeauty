/** Mirrors the tier payload returned by the API (backend/src/lib/loyalty.js). */
export interface RankTier {
  key: "bronze" | "silver" | "gold" | "diamond";
  name: string;
  icon: string;
  minPoints: number;
  benefits: string[];
}

export interface RankInfo extends RankTier {
  lifetimePoints: number;
  next: (RankTier & { pointsNeeded: number; progressPercent: number }) | null;
  allTiers: RankTier[];
}

interface TierTheme {
  /** Gradient for the membership card face. */
  card: string;
  /** Accent used for the progress bar fill and highlights. */
  bar: string;
  /** Small pill badge on light backgrounds. */
  badge: string;
  ring: string;
}

export const TIER_THEME: Record<RankTier["key"], TierTheme> = {
  bronze: {
    card: "from-[#8D6E52] via-[#A9825F] to-[#6F5540]",
    bar: "bg-[#A9825F]",
    badge: "bg-[#F4EAE0] text-[#8D6E52] border-[#E3D2C1]",
    ring: "ring-[#A9825F]/30",
  },
  silver: {
    card: "from-[#8C949E] via-[#B3BCC6] to-[#6E767F]",
    bar: "bg-[#8C949E]",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    ring: "ring-slate-400/30",
  },
  gold: {
    card: "from-[#C9992F] via-[#E7C35C] to-[#A87B1C]",
    bar: "bg-[#C9992F]",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    ring: "ring-amber-400/30",
  },
  diamond: {
    card: "from-[#2B8FA8] via-[#6FC7DC] to-[#1E6C82]",
    bar: "bg-[#2B8FA8]",
    badge: "bg-cyan-50 text-cyan-800 border-cyan-200",
    ring: "ring-cyan-400/30",
  },
};

export const themeFor = (key?: string): TierTheme =>
  TIER_THEME[(key as RankTier["key"]) ?? "bronze"] ?? TIER_THEME.bronze;
