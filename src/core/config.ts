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
  cols: 9,
  rows: 13,
  startArrows: 14,
  hearts: 3,
  maxHearts: 3,
  /** Game over when density is at least this and a wave cannot be placed. */
  overflowDensity: 0.85,
  boardClearBonus: 200,
  /** Seconds the board may sit below minOnBoard() before the next wave is pulled in early. */
  catchUpDelay: 0.35,
  /** Difficulty level gained per second of play... */
  levelPerSecond: 0.2,
  /** ...and per wave the player pulled in early by clearing fast. */
  levelPerEarlyWave: 0.25,
  /** Arrivals per second at level 0, and growth per level. */
  baseRate: 0.55,
  rateGrowth: 1.025,
};

/*
 * Dynamic difficulty. A level rises steadily with time and jumps a little
 * every time the player clears the board down early (which also pulls the
 * next wave in at once, so nobody waits on an empty board). The level sets
 * how many arrows arrive per second, how long they are and how tangled the
 * dependency chains get. Fast players climb faster; everyone is eventually
 * overwhelmed.
 */

/** Target arrivals per second at a difficulty level. */
export function arrivalRate(level: number): number {
  return RUSH.baseRate * Math.pow(RUSH.rateGrowth, level);
}

/** Seconds until the next timed wave. Waves get closer together but never below 1.5 s. */
export function spawnInterval(level: number): number {
  return Math.max(1.5, 3.2 * Math.pow(0.98, level));
}

/** Expected arrows in a wave: rate x interval (the caller rounds stochastically). */
export function waveSize(level: number): number {
  return Math.max(1, arrivalRate(level) * spawnInterval(level));
}

/** Below this many arrows the next wave is pulled in early. */
export function minOnBoard(level: number): number {
  return Math.min(16, 5 + Math.floor(level / 3));
}

export function rushPlacement(level: number): { len2Prob: number; len3Prob: number; chainBias: number } {
  return {
    len2Prob: 0.45,
    len3Prob: Math.min(0.45, 0.2 + 0.005 * level),
    chainBias: Math.min(0.9, 0.015 * level),
  };
}

export const DAILY = {
  cols: 9,
  rows: 13,
  fill: 0.65,
  hearts: 3,
  salt: 'fletchy-daily-v1',
  /** Puzzle #1 is this UTC date. */
  epoch: '2026-10-25',
  /** Par time in seconds per arrow on the board (3 stars = no mistakes and under par). */
  parPerArrow: 1.6,
  placement: { len2Prob: 0.45, len3Prob: 0.3, chainBias: 0.6 },
};

export const LEVELS = {
  hearts: 3,
  salt: 'fletchy-level-v1',
  /** Every Nth level is a boss level: a bigger board with longer, more tangled arrows. */
  bossEvery: 5,
  minCols: 8,
  maxCols: 14,
};

export interface LevelSpec {
  level: number;
  boss: boolean;
  cols: number;
  rows: number;
  fill: number;
  maxLen: number;
  bendProb: number;
  chainBias: number;
}

/** Board size and arrow style for a level. Grows slowly; boss levels jump ahead. */
export function levelSpec(level: number): LevelSpec {
  const boss = level % LEVELS.bossEvery === 0;
  const cols = Math.min(LEVELS.maxCols, LEVELS.minCols + Math.floor((level - 1) / 5) + (boss ? 3 : 0));
  return {
    level,
    boss,
    cols,
    rows: Math.round(cols * 1.5),
    fill: Math.min(0.95, 0.8 + 0.006 * level + (boss ? 0.04 : 0)),
    maxLen: Math.min(16, 4 + Math.floor(level / 3) + (boss ? 4 : 0)),
    bendProb: Math.min(0.55, 0.3 + 0.01 * level),
    chainBias: Math.min(0.8, 0.1 + 0.02 * level + (boss ? 0.2 : 0)),
  };
}
