import { SCORING } from './config.ts';

/** Multiplier = 1 + 0.5 * floor(combo / 5), capped. `combo` counts the current tap. */
export function comboMultiplier(combo: number): number {
  return Math.min(SCORING.maxMultiplier, 1 + SCORING.multiplierStep * Math.floor(combo / SCORING.comboPerStep));
}

export function arrowPoints(length: number, combo: number): number {
  return Math.round(SCORING.pointsPerCell * length * comboMultiplier(combo));
}
