import { Grid } from './grid.ts';
import { freeArrows } from './rules.ts';
import type { Board } from './types.ts';

/** A removal order that clears the board, or null if the board is stuck (has a cycle). */
export function solve(board: Board): number[] | null {
  const grid = Grid.from(board);
  const order: number[] = [];
  while (grid.size > 0) {
    const free = freeArrows(grid);
    if (free.length === 0) return null;
    for (const a of free) {
      grid.remove(a.id);
      order.push(a.id);
    }
  }
  return order;
}

export function isSolvable(board: Board): boolean {
  return solve(board) !== null;
}
