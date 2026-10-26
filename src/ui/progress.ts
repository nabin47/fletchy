import { type DailyResult, NO_STREAK, type Streak } from '../core/daily.ts';
import { read, write } from '../platform/storage.ts';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  theme: 'system' | 'dark' | 'light';
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, theme: 'light', reduceMotion: false };
export const HINTS_PER_DAY = 3;

export const STORAGE_KEYS = ['settings', 'rushBest', 'daily', 'streak', 'hints', 'tutorialDone', 'levelReached'] as const;

export interface RushBest {
  score: number;
  wave: number;
}

export const progress = {
  settings: (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings', {}) }),
  saveSettings: (s: Settings): void => write('settings', s),

  rushBest: (): RushBest => read('rushBest', { score: 0, wave: 0 }),
  /** Returns the previous best. */
  recordRush(score: number, wave: number): RushBest {
    const prev = this.rushBest();
    write('rushBest', { score: Math.max(prev.score, score), wave: Math.max(prev.wave, wave) });
    return prev;
  },

  dailyResult: (date: string): DailyResult | null => read<Record<string, DailyResult>>('daily', {})[date] ?? null,
  /** Only the first attempt of a day is official. Returns false if one already exists. */
  recordDaily(result: DailyResult): boolean {
    const all = read<Record<string, DailyResult>>('daily', {});
    if (all[result.date]) return false;
    all[result.date] = result;
    // Keep storage small: the last 60 days are plenty.
    const kept = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)).slice(-60));
    write('daily', kept);
    return true;
  },

  streak: (): Streak => read('streak', NO_STREAK),
  saveStreak: (s: Streak): void => write('streak', s),

  hintsLeft(date: string): number {
    const h = read<{ date: string; used: number }>('hints', { date, used: 0 });
    return h.date === date ? Math.max(0, HINTS_PER_DAY - h.used) : HINTS_PER_DAY;
  },
  useHint(date: string): void {
    write('hints', { date, used: HINTS_PER_DAY - this.hintsLeft(date) + 1 });
  },

  /** The highest level the player may play (one past the best cleared). */
  levelReached: (): number => Math.max(1, read('levelReached', 1)),
  recordLevel(level: number): void {
    if (level + 1 > this.levelReached()) write('levelReached', level + 1);
  },

  tutorialDone: (): boolean => read('tutorialDone', false),
  setTutorialDone: (): void => write('tutorialDone', true),
};
