// Headless bot balance simulation for Rush (PLAN.md Section 4).
// Prints a table to $GITHUB_STEP_SUMMARY in CI, or stdout locally.
// Usage: node scripts/sim.ts [gamesPerBot]
import { appendFileSync } from 'node:fs';
import { mulberry32 } from '../src/core/rng.ts';
import { freeArrows } from '../src/core/rules.ts';
import { RushGame } from '../src/core/rush.ts';

interface Bot {
  name: string;
  /** Seconds between taps at minimum. */
  reaction: number;
  /** Extra seconds of scanning per arrow on the board (bigger boards take longer to read). */
  scanPerArrow: number;
  /** Chance a tap goes to a blocked arrow. */
  errorRate: number;
}

const BOTS: Bot[] = [
  { name: 'beginner', reaction: 0.9, scanPerArrow: 0.06, errorRate: 0.12 },
  { name: 'casual', reaction: 0.65, scanPerArrow: 0.04, errorRate: 0.06 },
  { name: 'skilled', reaction: 0.45, scanPerArrow: 0.025, errorRate: 0.025 },
  { name: 'perfect', reaction: 0.3, scanPerArrow: 0.012, errorRate: 0 },
];

const DT = 1 / 30;
const MAX_TIME = 900;

interface Outcome {
  time: number;
  wave: number;
  score: number;
  reason: string;
}

function play(bot: Bot, seed: number): Outcome {
  const game = new RushGame(seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let readyAt = bot.reaction;
  while (!game.over && game.time < MAX_TIME) {
    game.tick(DT);
    if (game.over || game.time < readyAt || game.grid.size === 0) continue;
    const all = [...game.grid.arrows.values()];
    const free = freeArrows(game.grid);
    const blocked = all.filter((a) => !free.includes(a));
    const target = blocked.length > 0 && rng.chance(bot.errorRate) ? rng.pick(blocked) : rng.pick(free);
    game.tap(target.id);
    readyAt = game.time + bot.reaction * (0.8 + 0.4 * rng.next()) + bot.scanPerArrow * game.grid.size;
  }
  game.tick(0);
  return { time: game.time, wave: game.wave, score: game.score, reason: game.over ?? 'timeout' };
}

function pct(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

const games = Number(process.argv[2] ?? 200);
const lines = [
  `### Rush balance sim (${games} games per bot, cap ${MAX_TIME}s)`,
  '',
  '| Bot | Mean survival | p10 / p50 / p90 survival | Mean wave | Score p10 / p50 / p90 | Hearts / overflow / timeout |',
  '|---|---|---|---|---|---|',
];
for (const bot of BOTS) {
  const results: Outcome[] = [];
  for (let i = 0; i < games; i++) results.push(play(bot, 1000 + i));
  const times = results.map((r) => r.time);
  const scores = results.map((r) => r.score);
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const count = (reason: string): number => results.filter((r) => r.reason === reason).length;
  const s = (x: number): string => `${x.toFixed(0)}s`;
  lines.push(
    `| ${bot.name} | ${s(mean(times))} | ${s(pct(times, 10))} / ${s(pct(times, 50))} / ${s(pct(times, 90))} | ${mean(results.map((r) => r.wave)).toFixed(1)} | ${pct(scores, 10)} / ${pct(scores, 50)} / ${pct(scores, 90)} | ${count('hearts')} / ${count('overflow')} / ${count('timeout')} |`,
  );
}
lines.push('', 'Targets: beginner survives about 60-90 s; the perfect bot is eventually overwhelmed (no timeouts).', '');

const out = lines.join('\n');
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
