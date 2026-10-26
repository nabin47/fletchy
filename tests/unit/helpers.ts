import { expect } from 'vitest';
import type { Board } from '../../src/core/types.ts';
import { DIR_VEC } from '../../src/core/types.ts';

/** Asserts every structural invariant of a board: in bounds, no overlaps, connected arrows. */
export function expectWellFormed(board: Board, opts: { snake?: boolean } = {}): void {
  const seen = new Set<string>();
  const ids = new Set<number>();
  for (const a of board.arrows) {
    expect(ids.has(a.id)).toBe(false);
    ids.add(a.id);
    expect(a.cells.length).toBeGreaterThanOrEqual(1);
    if (!opts.snake) expect(a.cells.length).toBeLessThanOrEqual(3);
    const v = DIR_VEC[a.dir];
    a.cells.forEach((c, i) => {
      expect(c.x >= 0 && c.y >= 0 && c.x < board.cols && c.y < board.rows).toBe(true);
      const key = `${c.x},${c.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const prev = a.cells[i - 1];
      if (!prev) return;
      const step = { x: c.x - prev.x, y: c.y - prev.y };
      if (!opts.snake) expect(step).toEqual(v);
      // Snakes: cells are orthogonally adjacent, and the head points the way the last step went.
      else expect(Math.abs(step.x) + Math.abs(step.y)).toBe(1);
      if (opts.snake && i === a.cells.length - 1) expect(step).toEqual(v);
    });
  }
}
