import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/core/grid.ts';
import { firstBlocker, freeArrows, laneIds } from '../../src/core/rules.ts';
import { arrowPoints, comboMultiplier } from '../../src/core/scoring.ts';
import { solve } from '../../src/core/solver.ts';

describe('rules', () => {
  const grid = new Grid(4, 4);
  grid.add({ id: 1, dir: 'R', cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }); // head (1,1)
  grid.add({ id: 2, dir: 'U', cells: [{ x: 3, y: 2 }, { x: 3, y: 1 }] }); // head (3,1), sits in 1's lane
  grid.add({ id: 3, dir: 'D', cells: [{ x: 0, y: 3 }] });

  it('finds the nearest blocker in the lane', () => {
    expect(laneIds(grid, grid.arrows.get(1)!)).toEqual([2]);
    expect(firstBlocker(grid, grid.arrows.get(1)!)).toBe(2);
    expect(firstBlocker(grid, grid.arrows.get(2)!)).toBeNull();
  });

  it('lists free arrows and solves in dependency order', () => {
    expect(freeArrows(grid).map((a) => a.id).sort()).toEqual([2, 3]);
    const order = solve(grid.snapshot())!;
    expect(order.indexOf(2)).toBeLessThan(order.indexOf(1));
  });
});

describe('scoring', () => {
  it('multiplier steps every 5 combo and caps at x4', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.5);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(1000)).toBe(4);
  });

  it('points = 10 * length * multiplier', () => {
    expect(arrowPoints(3, 1)).toBe(30);
    expect(arrowPoints(2, 5)).toBe(30);
  });
});
