import { DAILY } from './config.ts';
import { generateBoard } from './generator.ts';
import { Grid } from './grid.ts';
import { hashString, mulberry32 } from './rng.ts';
import { firstBlocker } from './rules.ts';
import type { Board } from './types.ts';

const DAY_MS = 86_400_000;

/** UTC calendar date as YYYY-MM-DD, so the puzzle is the same worldwide. */
export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayIndex(dateStr: string): number {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`bad date ${dateStr}`);
  return Math.round(ms / DAY_MS);
}

/** Puzzle #1 is DAILY.epoch. */
export function puzzleNumber(dateStr: string): number {
  return dayIndex(dateStr) - dayIndex(DAILY.epoch) + 1;
}

export function dailySeed(dateStr: string): number {
  return hashString(`${DAILY.salt}:${dateStr}`);
}

export function dailyBoard(dateStr: string): Board {
  return generateBoard(mulberry32(dailySeed(dateStr)), {
    cols: DAILY.cols,
    rows: DAILY.rows,
    fill: DAILY.fill,
    placement: DAILY.placement,
  });
}

export function parSeconds(board: Board): number {
  return Math.round(board.arrows.length * DAILY.parPerArrow);
}

export interface DailyResult {
  date: string;
  puzzle: number;
  solved: boolean;
  seconds: number;
  mistakes: number;
  hearts: number;
  stars: 0 | 1 | 2 | 3;
}

export function starsFor(solved: boolean, mistakes: number, seconds: number, par: number): 0 | 1 | 2 | 3 {
  if (!solved) return 0;
  if (mistakes === 0 && seconds <= par) return 3;
  if (mistakes <= 1) return 2;
  return 1;
}

/** One fixed board, 3 hearts, clear everything. */
export class DailyGame {
  readonly date: string;
  readonly puzzle: number;
  readonly grid: Grid;
  readonly par: number;
  time = 0;
  hearts: number = DAILY.hearts;
  mistakes = 0;
  started = false;
  result: DailyResult | null = null;

  constructor(dateStr: string) {
    this.date = dateStr;
    this.puzzle = puzzleNumber(dateStr);
    const board = dailyBoard(dateStr);
    this.grid = Grid.from(board);
    this.par = parSeconds(board);
  }

  /** The clock only runs after the first tap. */
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
    const seconds = Math.round(this.time);
    this.result = {
      date: this.date,
      puzzle: this.puzzle,
      solved,
      seconds,
      mistakes: this.mistakes,
      hearts: this.hearts,
      stars: starsFor(solved, this.mistakes, seconds, this.par),
    };
  }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** e.g. "Fletchy Daily #12  0:42  ❤❤🤍\nhttps://..." */
export function shareText(result: DailyResult, appName: string, url: string, maxHearts = DAILY.hearts): string {
  const hearts = '❤'.repeat(Math.max(0, result.hearts)) + '🤍'.repeat(Math.max(0, maxHearts - result.hearts));
  const time = result.solved ? formatTime(result.seconds) : 'X';
  return `${appName} Daily #${result.puzzle}  ${time}  ${hearts}\n${url}`;
}

export interface Streak {
  lastDate: string | null;
  current: number;
  best: number;
}

export const NO_STREAK: Streak = { lastDate: null, current: 0, best: 0 };

/** Record an official (first) daily completion. Missing a day resets the streak. */
export function recordStreak(streak: Streak, dateStr: string): Streak {
  if (streak.lastDate === dateStr) return streak;
  const consecutive = streak.lastDate !== null && dayIndex(dateStr) - dayIndex(streak.lastDate) === 1;
  const current = consecutive ? streak.current + 1 : 1;
  return { lastDate: dateStr, current, best: Math.max(streak.best, current) };
}
