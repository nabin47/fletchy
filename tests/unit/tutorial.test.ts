import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/core/grid.ts';
import { freeArrows } from '../../src/core/rules.ts';
import { solve } from '../../src/core/solver.ts';
import { TUTORIAL } from '../../src/ui/tutorial.ts';
import { expectWellFormed } from './helpers.ts';

describe('tutorial lessons', () => {
  it('are well formed and solvable', () => {
    for (const lesson of TUTORIAL) {
      expectWellFormed(lesson.board);
      expect(solve(lesson.board)).not.toBeNull();
    }
  });

  it('lesson 2 starts with one blocked arrow (it teaches blocking)', () => {
    const board = TUTORIAL[1]!.board;
    expect(freeArrows(Grid.from(board)).length).toBeLessThan(board.arrows.length);
  });
});
