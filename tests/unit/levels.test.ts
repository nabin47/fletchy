import { describe, expect, it } from 'vitest';
import { LEVELS, levelSpec } from '../../src/core/config.ts';
import { Grid } from '../../src/core/grid.ts';
import { LevelGame, levelBoard } from '../../src/core/levels.ts';
import { freeArrows, laneCells } from '../../src/core/rules.ts';
import { solve } from '../../src/core/solver.ts';
import { head } from '../../src/core/types.ts';
import { expectWellFormed } from './helpers.ts';

describe('Levels', () => {
  it('levels 1-150 are full, solvable mazes with bent arrows', () => {
    let bent = 0;
    for (let n = 1; n <= 150; n++) {
      const board = levelBoard(n);
      const spec = levelSpec(n);
      expect([board.cols, board.rows]).toEqual([spec.cols, spec.rows]);
      expectWellFormed(board, { snake: true });
      if (solve(board) === null) throw new Error(`level ${n} is unsolvable`);
      // Every cell of a level is covered by an arrow.
      expect(Grid.from(board).density()).toBe(1);
      const g = Grid.from(board);
      for (const a of board.arrows) {
        // No arrow's exit lane runs through its own body.
        const lane = laneCells(g, head(a), a.dir);
        expect(lane.some((l) => a.cells.some((c) => c.x === l.x && c.y === l.y))).toBe(false);
        const xs = new Set(a.cells.map((c) => c.x));
        const ys = new Set(a.cells.map((c) => c.y));
        if (xs.size > 1 && ys.size > 1) bent++;
      }
    }
    expect(bent).toBeGreaterThan(500);
  }, 60_000);

  it('the same level is the same board for everyone', () => {
    expect(levelBoard(17)).toEqual(levelBoard(17));
    expect(levelBoard(17)).not.toEqual(levelBoard(18));
  });

  it('grids grow with the level and every 5th level is a bigger boss board', () => {
    expect(levelSpec(1).cols).toBe(LEVELS.minCols);
    expect(levelSpec(40).cols).toBeGreaterThan(levelSpec(1).cols);
    for (const boss of [5, 10, 15, 20]) {
      expect(levelSpec(boss).boss).toBe(true);
      expect(levelSpec(boss).cols).toBeGreaterThan(levelSpec(boss - 1).cols);
      expect(levelSpec(boss).maxLen).toBeGreaterThan(levelSpec(boss - 1).maxLen);
    }
    expect(levelSpec(4).boss).toBe(false);
    expect(levelSpec(1000).cols).toBe(LEVELS.maxCols);
  });

  it('clearing every arrow solves the level; three mistakes fail it', () => {
    const win = new LevelGame(3);
    while (win.grid.size > 0) win.tap(freeArrows(win.grid)[0]!.id);
    expect(win.result).toMatchObject({ level: 3, solved: true, mistakes: 0 });

    const lose = new LevelGame(3);
    const free = new Set(freeArrows(lose.grid).map((a) => a.id));
    const blocked = [...lose.grid.arrows.values()].find((a) => !free.has(a.id))!;
    for (let i = 0; i < 3; i++) lose.tap(blocked.id);
    expect(lose.result).toMatchObject({ solved: false, mistakes: 3 });
  });
});
