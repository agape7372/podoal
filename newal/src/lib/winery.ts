// ─── Winery Tier System & Utilities ─────────────────────────

export interface WineryTier {
  level: number;
  minGrapes: number;
  name: string;
  icon: string;
  color: string; // tailwind gradient class
}

export const WINERY_TIERS: WineryTier[] = [
  { level: 1, minGrapes: 0, name: '포도알 새싹', icon: '\u{1F331}', color: 'from-grape-100 to-grape-50' },
  { level: 2, minGrapes: 30, name: '포도 수확생', icon: '\u{1F347}', color: 'from-grape-200 to-grape-100' },
  { level: 3, minGrapes: 100, name: '주스 메이커', icon: '\u{1F9C3}', color: 'from-orange-200 to-amber-100' },
  { level: 4, minGrapes: 300, name: '포도주 견습생', icon: '\u{1F377}', color: 'from-grape-300 to-grape-200' },
  { level: 5, minGrapes: 500, name: '소믈리에', icon: '\u{1F942}', color: 'from-amber-300 to-amber-200' },
  { level: 6, minGrapes: 1000, name: '와이너리 오너', icon: '\u{1F3F0}', color: 'from-grape-400 to-grape-300' },
  { level: 7, minGrapes: 2000, name: '포도 마스터', icon: '\u{1F451}', color: 'from-amber-400 to-amber-300' },
];

/**
 * Returns the current tier for a given total grape count.
 * Finds the highest tier whose minGrapes the user has met.
 */
export function getCurrentTier(totalGrapes: number): WineryTier {
  let current = WINERY_TIERS[0];
  for (const tier of WINERY_TIERS) {
    if (totalGrapes >= tier.minGrapes) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Returns the next tier after the user's current tier, or null if at max.
 */
export function getNextTier(totalGrapes: number): WineryTier | null {
  const current = getCurrentTier(totalGrapes);
  const nextIndex = WINERY_TIERS.findIndex((t) => t.level === current.level) + 1;
  return nextIndex < WINERY_TIERS.length ? WINERY_TIERS[nextIndex] : null;
}

/**
 * Returns 0-100 progress percentage toward the next tier.
 * Returns 100 if the user is at the maximum tier.
 */
export function getTierProgress(totalGrapes: number): number {
  const current = getCurrentTier(totalGrapes);
  const next = getNextTier(totalGrapes);
  if (!next) return 100;

  const rangeStart = current.minGrapes;
  const rangeEnd = next.minGrapes;
  const progress = ((totalGrapes - rangeStart) / (rangeEnd - rangeStart)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

// ─── Wine Bottle Types ──────────────────────────────────────

export type BottleSize = 'piccolo' | 'standard' | 'magnum' | 'jeroboam';

/**
 * Maps board totalStickers to a wine bottle size.
 */
export function getBottleSize(totalStickers: number): BottleSize {
  if (totalStickers >= 30) return 'jeroboam';
  if (totalStickers >= 20) return 'magnum';
  if (totalStickers >= 15) return 'standard';
  return 'piccolo';
}

export const BOTTLE_SIZE_LABELS: Record<BottleSize, string> = {
  piccolo: '피콜로 (10알)',
  standard: '스탠다드 (15알)',
  magnum: '매그넘 (20알)',
  jeroboam: '제로보암 (30알)',
};

export interface WineBottle {
  boardId: string;
  title: string;
  totalStickers: number;
  bottleSize: BottleSize;
  completedAt: string;
  createdAt: string;
  daysToComplete: number;
  vintage: string;
}
