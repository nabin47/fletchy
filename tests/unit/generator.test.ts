import { describe, expect, it } from 'vitest';
import { RUSH, DAILY } from '../../src/core/config.ts';
import { isAcyclic, longestChain, wouldCreateCycle } from '../../src/core/dependency.ts';
import { allValidPlacements, generateBoard, placeArrow, straightCells } from '../../src/core/generator.ts';
import { Grid } from '../../src/core/grid.ts';
import { mulberry32 } from '../../src/core/rng.ts';
import { freeArrows } from '../../src/core/rules.ts';
import { isSolvable, solve } from '../../src/core/solver.ts';
import { expectWellFormed } from './helpers.ts';

describe('generator: 10,000 random seeds', () => {
  it('every board is well formed and solvable', () => {
    for (let seed = 0; seed < 10_000; seed++) {
      const rng = mulberry32(seed);
      const board = generateBoard(rng, {
        cols: RUSH.cols,
        rows: RUSH.rows,
        maxArrows: 8 + (seed % 20),
        placement: { chainBias: (seed % 5) / 5, len3Prob: 0.3 },
      });
      expectWellFormed(board);
      const order = solve(board);
      if (order === null) throw new Error(`seed ${seed} produced an unsolvable board`);
      expect(order).toHaveLength(board.arrows.length);
    }
  }, 120_000);
});

describe('generator', () => {
  it('same seed gives the identical board', () => {
    const spec = { cols: 7, rows: 10, maxArrows: 10 };
    expect(generateBoard(mulberry32(42), spec)).toEqual(generateBoard(mulberry32(42), spec));
    expect(generateBoard(mulberry32(42), spec)).not.toEqual(generateBoard(mulberry32(43), spec));
  });

  it('matches a golden board (determinism across Node versions)', () => {
    const board = generateBoard(mulberry32(42), { cols: 7, rows: 10, maxArrows: 10 });
    const compact = board.arrows.map((a) => [a.dir, ...a.cells.map((c) => `${c.x},${c.y}`)]);
    expect(compact).toEqual([
      ['L', '3,8'],
      ['U', '3,2'],
      ['L', '3,1', '2,1'],
      ['L', '5,0', '4,0'],
      ['D', '0,1'],
      ['D', '5,2', '5,3'],
      ['U', '4,3', '4,2'],
      ['D', '2,0'],
      ['L', '6,9', '5,9', '4,9'],
      ['L', '6,0'],
    ]);
  });

  it('fills to the requested density and stays solvable until full', () => {
    for (let seed = 0; seed < 50; seed++) {
      const grid = new Grid(DAILY.cols, DAILY.rows);
      const rng = mulberry32(seed);
      while (placeArrow(grid, rng, { len2Prob: 0.4, len3Prob: 0.3, chainBias: 0.5, samples: 4, attempts: 30 })) {
        expect(isAcyclic(grid)).toBe(true);
        expect(freeArrows(grid).length).toBeGreaterThan(0);
      }
      // When placement fails, no valid placement remains at all.
      expect(allValidPlacements(grid)).toHaveLength(0);
      expect(grid.density()).toBeGreaterThan(0.65);
      expect(isSolvable(grid.snapshot())).toBe(true);
    }
  });

  it('chainBias lengthens dependency chains', () => {
    const avgChain = (chainBias: number): number => {
      let total = 0;
      for (let seed = 0; seed < 200; seed++) {
        const g = Grid.from(generateBoard(mulberry32(seed), { cols: 7, rows: 10, maxArrows: 20, placement: { chainBias } }));
        total += longestChain(g);
      }
      return total / 200;
    };
    expect(avgChain(1)).toBeGreaterThan(avgChain(0));
  });
});

describe('dependency cycles', () => {
  it('rejects two arrows facing each other in one row', () => {
    const grid = new Grid(5, 1);
    grid.add({ id: 1, dir: 'R', cells: [{ x: 0, y: 0 }] });
    // An arrow at x=4 pointing left has arrow 1 in its lane, and sits in arrow 1's lane.
    expect(wouldCreateCycle(grid, { dir: 'L', cells: [{ x: 4, y: 0 }] })).toBe(true);
    // Pointing right instead it simply leaves; arrow 1 depends on it, no cycle.
    expect(wouldCreateCycle(grid, { dir: 'R', cells: [{ x: 4, y: 0 }] })).toBe(false);
  });

  it('rejects a longer cycle through three arrows', () => {
    // 1 (R at 0,0) depends on 2 at (2,0); 2 (D) depends on 3 at (2,2); a new arrow at (0,2) pointing U
    // would depend on 1 and sit in 3's lane (3 points L), closing 1 -> 2 -> 3 -> new -> 1.
    const grid = new Grid(3, 3);
    grid.add({ id: 1, dir: 'R', cells: [{ x: 0, y: 0 }] });
    grid.add({ id: 2, dir: 'D', cells: [{ x: 2, y: 0 }] });
    grid.add({ id: 3, dir: 'L', cells: [{ x: 2, y: 2 }] });
    expect(isAcyclic(grid)).toBe(true);
    expect(wouldCreateCycle(grid, { dir: 'U', cells: straightCells({ x: 0, y: 1 }, 'U', 1) })).toBe(false);
    expect(wouldCreateCycle(grid, { dir: 'U', cells: [{ x: 0, y: 2 }] })).toBe(true);
  });
});
