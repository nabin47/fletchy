import { RUSH, SCORING, rushPlacement, spawnInterval, waveSizeRange } from './config.ts';
import { DEFAULT_PLACEMENT, placeArrow } from './generator.ts';
import { Grid } from './grid.ts';
import { mulberry32, type Rng } from './rng.ts';
import { firstBlocker } from './rules.ts';
import { arrowPoints } from './scoring.ts';
import type { Arrow } from './types.ts';

export type GameOverReason = 'hearts' | 'overflow';

export type TapResult =
  | { kind: 'cleared'; arrow: Arrow; points: number; combo: number }
  | { kind: 'blocked'; arrow: Arrow; blockerId: number; hearts: number }
  | { kind: 'ignored' };

export type RushEvent =
  | { type: 'spawn'; wave: number; arrows: Arrow[] }
  | { type: 'boardClear'; bonus: number }
  | { type: 'heartRestored'; hearts: number }
  | { type: 'comboExpired' }
  | { type: 'gameOver'; reason: GameOverReason };

interface WaveTrack {
  remaining: Set<number>;
  clean: boolean;
}

/** Endless survival mode. Pure logic: the UI calls tap() and tick(dt). */
export class RushGame {
  readonly grid: Grid;
  readonly seed: number;
  time = 0;
  hearts: number = RUSH.hearts;
  score = 0;
  combo = 0;
  bestCombo = 0;
  wave = 0;
  arrowsCleared = 0;
  mistakes = 0;
  nextSpawnAt: number;
  over: GameOverReason | null = null;
  /** Events produced by tap() since the last tick(); drained by tick(). */
  private pending: RushEvent[] = [];
  private readonly rng: Rng;
  private lastCorrectAt = -Infinity;
  private readonly waves = new Map<number, WaveTrack>();
  private readonly waveOf = new Map<number, number>();

  constructor(seed: number) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.grid = new Grid(RUSH.cols, RUSH.rows);
    const placement = { ...DEFAULT_PLACEMENT, ...rushPlacement(0) };
    const start: Arrow[] = [];
    for (let i = 0; i < RUSH.startArrows; i++) {
      const a = placeArrow(this.grid, this.rng, placement);
      if (!a) break;
      start.push(a);
    }
    this.track(0, start);
    this.nextSpawnAt = spawnInterval(0);
  }

  /** Fraction of the board covered, 0..1 (drives the pressure ring). */
  pressure(): number {
    return this.grid.density();
  }

  tapCell(x: number, y: number): TapResult {
    const id = this.grid.at(x, y);
    return id < 0 ? { kind: 'ignored' } : this.tap(id);
  }

  tap(id: number): TapResult {
    const arrow = this.grid.arrows.get(id);
    if (this.over || !arrow) return { kind: 'ignored' };
    this.expireCombo();

    const blockerId = firstBlocker(this.grid, arrow);
    if (blockerId !== null) {
      this.hearts--;
      this.mistakes++;
      this.combo = 0;
      for (const w of this.waves.values()) w.clean = false;
      if (this.hearts <= 0) this.end('hearts');
      return { kind: 'blocked', arrow, blockerId, hearts: this.hearts };
    }

    this.grid.remove(id);
    this.arrowsCleared++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastCorrectAt = this.time;
    const points = arrowPoints(arrow.cells.length, this.combo);
    this.score += points;
    this.untrack(id);

    if (this.grid.size === 0) {
      this.score += RUSH.boardClearBonus;
      this.nextSpawnAt += RUSH.boardClearDelay;
      this.pending.push({ type: 'boardClear', bonus: RUSH.boardClearBonus });
    }
    return { kind: 'cleared', arrow, points, combo: this.combo };
  }

  /** Advance the clock. Returns events from taps since the last tick plus any new ones. */
  tick(dt: number): RushEvent[] {
    const events = this.pending;
    this.pending = [];
    if (this.over) return events;
    this.time += dt;
    if (this.expireCombo()) events.push({ type: 'comboExpired' });
    while (!this.over && this.time >= this.nextSpawnAt) events.push(...this.spawnWave());
    return events;
  }

  private spawnWave(): RushEvent[] {
    this.wave++;
    const [min, max] = waveSizeRange(this.wave);
    const size = min + this.rng.int(max - min + 1);
    const placement = { ...DEFAULT_PLACEMENT, ...rushPlacement(this.wave) };
    const placed: Arrow[] = [];
    let blocked = false;
    for (let i = 0; i < size; i++) {
      const a = placeArrow(this.grid, this.rng, placement);
      if (!a) {
        blocked = true;
        break;
      }
      placed.push(a);
    }
    this.track(this.wave, placed);
    this.nextSpawnAt += spawnInterval(this.wave);
    const events: RushEvent[] = [{ type: 'spawn', wave: this.wave, arrows: placed }];
    if (blocked && this.grid.density() >= RUSH.overflowDensity) {
      this.end('overflow');
      events.push({ type: 'gameOver', reason: 'overflow' });
    }
    return events;
  }

  private end(reason: GameOverReason): void {
    this.over = reason;
    if (reason === 'hearts') this.pending.push({ type: 'gameOver', reason });
  }

  private expireCombo(): boolean {
    if (this.combo > 0 && this.time - this.lastCorrectAt > SCORING.comboTimeout) {
      this.combo = 0;
      return true;
    }
    return false;
  }

  private track(wave: number, arrows: Arrow[]): void {
    if (arrows.length === 0) return;
    this.waves.set(wave, { remaining: new Set(arrows.map((a) => a.id)), clean: true });
    for (const a of arrows) this.waveOf.set(a.id, wave);
  }

  /** A wave cleared with no wrong taps while it was on the board restores a heart. */
  private untrack(id: number): void {
    const wave = this.waveOf.get(id);
    if (wave === undefined) return;
    this.waveOf.delete(id);
    const track = this.waves.get(wave);
    if (!track) return;
    track.remaining.delete(id);
    if (track.remaining.size > 0) return;
    this.waves.delete(wave);
    if (track.clean && this.hearts < RUSH.maxHearts) {
      this.hearts++;
      this.pending.push({ type: 'heartRestored', hearts: this.hearts });
    }
  }
}
