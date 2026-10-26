import { LEVELS, levelSpec, type LevelSpec } from './config.ts';
import { fillGaps, fillGrid } from './generator.ts';
import { Grid } from './grid.ts';
import { hashString, mulberry32 } from './rng.ts';
import { firstBlocker } from './rules.ts';
import type { Board } from './types.ts';

/**
 * The board for a level: the same for everyone, every time, and with no
 * empty cell. Long bent arrows go first, then fillGaps() grows them (or
 * adds short arrows) into whatever is left. In the rare case a hole cannot be closed
 * without making the board unsolvable, the next seed variant is tried.
 */
export function levelBoard(level: number): Board {
  const spec = levelSpec(level);
  let best: { board: Board; holes: number } | null = null;
  for (let attempt = 0; attempt < LEVELS.maxAttempts; attempt++) {
    const rng = mulberry32(hashString(`${LEVELS.salt}:${level}:${attempt}`));
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

export interface LevelResult {
  level: number;
  solved: boolean;
  seconds: number;
  mistakes: number;
}

/** Clear every arrow with 3 hearts. Losing all hearts fails the level (retry the same board). */
export class LevelGame {
  readonly level: number;
  readonly spec: LevelSpec;
  readonly grid: Grid;
  time = 0;
  hearts: number = LEVELS.hearts;
  mistakes = 0;
  started = false;
  result: LevelResult | null = null;

  constructor(level: number) {
    this.level = level;
    this.spec = levelSpec(level);
    this.grid = Grid.from(levelBoard(level));
  }

  tick(dt: number): void {
    if (this.started && !this.result) this.time += dt;
  }

  tap(id: number): 'cleared' | 'blocked' | 'ignored' {
    const arrow = this.grid.arrows.get(id);
    if (this.result || !arrow) return 'ignored';
    this.started = true;
    if (firstBlocker(this.grid, arrow) !== null) {
      this.mistakes++;
      this.hearts--;
      if (this.hearts <= 0) this.finish(false);
      return 'blocked';
    }
    this.grid.remove(id);
    if (this.grid.size === 0) this.finish(true);
    return 'cleared';
  }

  private finish(solved: boolean): void {
    this.result = { level: this.level, solved, seconds: Math.round(this.time), mistakes: this.mistakes };
  }
}
