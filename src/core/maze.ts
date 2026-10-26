import { fillGaps, fillGrid } from './generator.ts';
import { Grid } from './grid.ts';
import { hashString, mulberry32 } from './rng.ts';
import type { Board } from './types.ts';

export interface MazeSpec {
  cols: number;
  rows: number;
  /** Density reached with long bent arrows before gaps are filled. */
  fill: number;
  maxLen: number;
  bendProb: number;
  chainBias: number;
}

/** Seed variants tried until one covers every cell. */
const MAX_ATTEMPTS = 40;

/**
 * A full, solvable maze: no empty cell. Long bent arrows go first, then
 * fillGaps() grows them (or adds short arrows) into whatever is left. In the
 * rare case a hole cannot be closed without making the board unsolvable, the
 * next seed variant (`<seed>:<attempt>`) is tried. Deterministic per seed.
 */
export function mazeBoard(seed: string, spec: MazeSpec): Board {
  let best: { board: Board; holes: number } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(hashString(`${seed}:${attempt}`));
    const grid = new Grid(spec.cols, spec.rows);
    fillGrid(grid, rng, {
      fill: spec.fill,
      placement: { snake: { maxLen: spec.maxLen, bendProb: spec.bendProb }, chainBias: spec.chainBias, samples: 4, attempts: 120 },
    });
    const holes = fillGaps(grid, rng);
    if (!best || holes < best.holes) best = { board: grid.snapshot(), holes };
    if (holes === 0) break;
  }
  return (best as { board: Board }).board;
}
