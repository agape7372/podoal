// Small pure UI formatting helpers (no data-layer coupling).

/**
 * Board fill progress as an integer percentage, clamped to 0–100 and guarded
 * against a zero total. Used by board cards, the grape board, the share card,
 * and relay progress bars so the calculation stays consistent everywhere.
 */
export function progressPercent(filled: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((filled / total) * 100));
}
