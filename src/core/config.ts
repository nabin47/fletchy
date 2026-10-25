/*
 * Every gameplay number lives here so balance can be tuned in one place.
 * `npm run sim` reports how bots of different skill fare with these values.
 */

export const SCORING = {
  pointsPerCell: 10,
  comboPerStep: 5,
  multiplierStep: 0.5,
  maxMultiplier: 4,
  /** Combo resets after this many seconds without a correct tap. */
  comboTimeout: 2.5,
};

export const RUSH = {
  cols: 7,
  rows: 10,
  startArrows: 10,
  hearts: 3,
  maxHearts: 3,
  /** Game over when density is at least this and a wave cannot be placed. */
  overflowDensity: 0.85,
  boardClearBonus: 200,
  boardClearDelay: 2,
  spawnBase: 4.2,
  spawnDecay: 0.97,
  spawnMin: 1.4,
};

/** Seconds until the wave after `wave` spawns. */
export function spawnInterval(wave: number): number {
  return Math.max(RUSH.spawnMin, RUSH.spawnBase * Math.pow(RUSH.spawnDecay, wave));
}

/** [min, max] arrows in a wave. Starts at 1..3 and grows slowly. */
export function waveSizeRange(wave: number): [number, number] {
  const extra = Math.floor(wave / 12);
  return [1 + Math.min(2, Math.floor(wave / 8)), 3 + extra];
}

export function rushPlacement(wave: number): { len2Prob: number; len3Prob: number; chainBias: number } {
  return {
    len2Prob: 0.4,
    len3Prob: Math.min(0.4, 0.15 + 0.01 * wave),
    chainBias: Math.min(0.85, 0.02 * wave),
  };
}

export const DAILY = {
  cols: 8,
  rows: 10,
  fill: 0.65,
  hearts: 3,
  salt: 'fletchy-daily-v1',
  /** Puzzle #1 is this UTC date. */
  epoch: '2026-11-01',
  /** Par time in seconds per arrow on the board (3 stars = no mistakes and under par). */
  parPerArrow: 1.6,
  placement: { len2Prob: 0.45, len3Prob: 0.3, chainBias: 0.6 },
};
