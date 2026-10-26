/* i18n-ready string table. Add a language by adding a table with the same keys. */

const en = {
  rush: 'Rush',
  rushTagline: 'Endless. Clear arrows before the board fills.',
  daily: 'Daily Grid',
  dailyTagline: 'One puzzle a day, the same for everyone.',
  dailyDone: 'Done today',
  levels: 'Levels',
  levelsTagline: 'Clear the whole maze. A boss every 5 levels.',
  levelTitle: 'Level {n}',
  bossLevel: 'Boss level',
  levelCleared: 'Level {n} cleared',
  nextLevel: 'Next level',
  bossNext: 'Next up: a boss level',
  arrowsLeft: '{n} arrows left',
  settings: 'Settings',
  best: 'Best',
  score: 'Score',
  wave: 'Wave',
  combo: 'Combo',
  pause: 'Pause',
  paused: 'Paused',
  resume: 'Resume',
  menu: 'Menu',
  retry: 'Tap to retry',
  restart: 'Restart',
  hint: 'Hint',
  hintsLeft: '{n} left today',
  gameOver: 'Game over',
  overflow: 'The board filled up',
  outOfHearts: 'Out of hearts',
  newBest: 'New best!',
  soClose: 'So close! {n} more to beat your best.',
  bestWave: 'Best wave {n}',
  bestCombo: 'Best combo {n}',
  dailyTitle: 'Daily #{n}',
  solved: 'Solved!',
  failed: 'Out of hearts',
  time: 'Time',
  mistakes: 'Mistakes',
  par: 'Par {t}',
  streak: 'Streak {n}',
  share: 'Share',
  shared: 'Shared!',
  copied: 'Copied to clipboard',
  shareFailed: 'Could not share',
  practice: 'Practice replay (does not count)',
  playAgain: 'Play again',
  back: 'Back',
  sound: 'Sound',
  haptics: 'Vibration',
  theme: 'Theme',
  themeSystem: 'System',
  themeDark: 'Dark',
  themeLight: 'Light',
  reduceMotion: 'Reduce motion',
  replayTutorial: 'Replay tutorial',
  privacy: 'Privacy',
  on: 'On',
  off: 'Off',
  skip: 'Skip',
  tut1: 'Tap an arrow to send it flying.',
  tut2: 'An arrow can only leave if nothing is in its way. Free the path first.',
  tut3: 'Clear the whole board!',
  tutDone: 'You got it. Have fun!',
  heartsLabel: '{n} of {max} hearts',
  pressureLabel: 'Board {n}% full',
} as const;

export type StringKey = keyof typeof en;

const tables: Record<string, Record<StringKey, string>> = { en };
let current: Record<StringKey, string> = en;

export function setLanguage(lang: string): void {
  current = tables[lang.split('-')[0] ?? 'en'] ?? en;
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = current[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
