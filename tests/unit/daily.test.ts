import { describe, expect, it } from 'vitest';
import { DAILY } from '../../src/core/config.ts';
import {
  DailyGame,
  NO_STREAK,
  dailyBoard,
  formatTime,
  puzzleNumber,
  recordStreak,
  shareText,
  starsFor,
  utcDateString,
} from '../../src/core/daily.ts';
import { Grid } from '../../src/core/grid.ts';
import { freeArrows } from '../../src/core/rules.ts';
import { isSolvable } from '../../src/core/solver.ts';
import { expectWellFormed } from './helpers.ts';

describe('Daily Grid', () => {
  it('uses the UTC date', () => {
    expect(utcDateString(new Date('2026-11-01T23:30:00-05:00'))).toBe('2026-11-02');
    expect(utcDateString(new Date('2026-11-02T01:00:00+09:00'))).toBe('2026-11-01');
  });

  it('same date, same board; different dates differ', () => {
    expect(dailyBoard('2026-11-05')).toEqual(dailyBoard('2026-11-05'));
    expect(dailyBoard('2026-11-05')).not.toEqual(dailyBoard('2026-11-06'));
  });

  it('a year of boards is 8x10, about 65% full and solvable', () => {
    const start = Date.parse('2026-11-01T00:00:00Z');
    for (let d = 0; d < 365; d++) {
      const date = utcDateString(new Date(start + d * 86_400_000));
      const board = dailyBoard(date);
      expect(board.cols).toBe(DAILY.cols);
      expect(board.rows).toBe(DAILY.rows);
      expectWellFormed(board);
      expect(isSolvable(board)).toBe(true);
      const density = Grid.from(board).density();
      expect(density).toBeGreaterThanOrEqual(0.6);
      expect(density).toBeLessThan(0.72);
    }
  });

  it('numbers puzzles from the epoch', () => {
    expect(puzzleNumber(DAILY.epoch)).toBe(1);
    expect(puzzleNumber('2026-11-12')).toBe(12);
  });

  it('a clean fast solve earns 3 stars', () => {
    const g = new DailyGame('2026-11-03');
    while (g.grid.size > 0) {
      g.tap(freeArrows(g.grid)[0]!.id);
      g.tick(0.5);
    }
    expect(g.result).toMatchObject({ solved: true, mistakes: 0, hearts: 3, stars: 3 });
  });

  it('three mistakes fail the puzzle', () => {
    const g = new DailyGame('2026-11-04');
    const free = new Set(freeArrows(g.grid).map((a) => a.id));
    const blocked = [...g.grid.arrows.values()].find((a) => !free.has(a.id))!;
    for (let i = 0; i < 3; i++) g.tap(blocked.id);
    expect(g.result).toMatchObject({ solved: false, hearts: 0, stars: 0 });
  });

  it('stars', () => {
    expect(starsFor(true, 0, 30, 40)).toBe(3);
    expect(starsFor(true, 0, 50, 40)).toBe(2);
    expect(starsFor(true, 1, 30, 40)).toBe(2);
    expect(starsFor(true, 2, 30, 40)).toBe(1);
    expect(starsFor(false, 0, 30, 40)).toBe(0);
  });

  it('builds share text', () => {
    const text = shareText(
      { date: '2026-11-12', puzzle: 12, solved: true, seconds: 42, mistakes: 1, hearts: 2, stars: 2 },
      'Fletchy',
      'https://nabin47.github.io/fletchy/',
    );
    expect(text).toBe('Fletchy Daily #12  0:42  ❤❤🤍\nhttps://nabin47.github.io/fletchy/');
    expect(formatTime(125)).toBe('2:05');
  });

  it('streak counts consecutive days and resets after a gap', () => {
    let s = recordStreak(NO_STREAK, '2026-11-01');
    s = recordStreak(s, '2026-11-02');
    s = recordStreak(s, '2026-11-02');
    expect(s).toEqual({ lastDate: '2026-11-02', current: 2, best: 2 });
    s = recordStreak(s, '2026-11-05');
    expect(s).toEqual({ lastDate: '2026-11-05', current: 1, best: 2 });
  });
});
