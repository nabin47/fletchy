import { LEVELS, levelSpec, type LevelSpec } from './config.ts';
import { Grid } from './grid.ts';
import { mazeBoard } from './maze.ts';
import { firstBlocker } from './rules.ts';
import type { Board } from './types.ts';

/** The board for a level: a full maze, the same for everyone, every time. */
export function levelBoard(level: number): Board {
  return mazeBoard(`${LEVELS.salt}:${level}`, levelSpec(level));
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
