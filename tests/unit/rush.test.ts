import { describe, expect, it } from 'vitest';
import { RUSH, spawnInterval } from '../../src/core/config.ts';
import { isAcyclic } from '../../src/core/dependency.ts';
import { mulberry32 } from '../../src/core/rng.ts';
import { freeArrows } from '../../src/core/rules.ts';
import { RushGame } from '../../src/core/rush.ts';
import { expectWellFormed } from './helpers.ts';

describe('Rush', () => {
  it('starts with the configured board', () => {
    const g = new RushGame(1);
    expect(g.grid.size).toBe(RUSH.startArrows);
    expect(g.hearts).toBe(3);
    expect(freeArrows(g.grid).length).toBeGreaterThan(0);
  });

  it('after every spawn the board is solvable and has a free arrow', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = new RushGame(seed);
      const rng = mulberry32(seed);
      let spawns = 0;
      while (!g.over && g.time < 300) {
        for (const e of g.tick(0.1)) {
          if (e.type !== 'spawn') continue;
          spawns++;
          if (g.grid.size > 0) expect(freeArrows(g.grid).length).toBeGreaterThan(0);
          expect(isAcyclic(g.grid)).toBe(true);
        }
        // A slow, error-free player: one tap every ~0.8 s.
        if (g.grid.size > 0 && rng.chance(0.12)) g.tap(rng.pick(freeArrows(g.grid)).id);
      }
      expectWellFormed(g.grid.snapshot());
      expect(spawns).toBeGreaterThan(0);
    }
  });

  it('a blocked tap costs a heart and resets combo; three ends the game', () => {
    const g = new RushGame(5);
    const free = new Set(freeArrows(g.grid).map((a) => a.id));
    const blocked = [...g.grid.arrows.values()].find((a) => !free.has(a.id));
    expect(blocked).toBeDefined();
    const res = g.tap(blocked!.id);
    expect(res.kind).toBe('blocked');
    expect(g.hearts).toBe(2);
    expect(g.combo).toBe(0);
    g.tap(blocked!.id);
    g.tap(blocked!.id);
    expect(g.over).toBe('hearts');
    expect(g.tick(0.1)).toContainEqual({ type: 'gameOver', reason: 'hearts' });
    expect(g.tap(blocked!.id).kind).toBe('ignored');
  });

  it('scores correct taps, builds combo and expires it after idling', () => {
    const g = new RushGame(9);
    const a = freeArrows(g.grid)[0]!;
    const res = g.tap(a.id);
    expect(res).toMatchObject({ kind: 'cleared', points: 10 * a.cells.length, combo: 1 });
    expect(g.combo).toBe(1);
    const events = g.tick(2.6);
    expect(events).toContainEqual({ type: 'comboExpired' });
    expect(g.combo).toBe(0);
  });

  it('clearing the whole board gives the bonus and delays the next wave', () => {
    const g = new RushGame(3);
    const before = g.nextSpawnAt;
    while (g.grid.size > 0) g.tap(freeArrows(g.grid)[0]!.id);
    expect(g.nextSpawnAt).toBe(before + RUSH.boardClearDelay);
    expect(g.tick(0).some((e) => e.type === 'boardClear')).toBe(true);
    expect(g.score).toBeGreaterThanOrEqual(RUSH.boardClearBonus);
  });

  it('a perfectly cleared wave restores a heart', () => {
    const g = new RushGame(11);
    const free = new Set(freeArrows(g.grid).map((a) => a.id));
    const blocked = [...g.grid.arrows.values()].find((a) => !free.has(a.id))!;
    g.tap(blocked.id); // dirty wave 0
    expect(g.hearts).toBe(2);
    while (g.grid.size > 0) g.tap(freeArrows(g.grid)[0]!.id);
    expect(g.hearts).toBe(2); // wave 0 was not clean
    g.tick(g.nextSpawnAt - g.time + 0.01); // spawn wave 1
    expect(g.wave).toBe(1);
    const restored: unknown[] = [];
    while (g.grid.size > 0) {
      g.tap(freeArrows(g.grid)[0]!.id);
    }
    restored.push(...g.tick(0).filter((e) => e.type === 'heartRestored'));
    expect(restored).toHaveLength(1);
    expect(g.hearts).toBe(3);
  });

  it('spawn interval follows max(1.4, 4.2 * 0.97^wave)', () => {
    expect(spawnInterval(0)).toBeCloseTo(4.2);
    expect(spawnInterval(10)).toBeCloseTo(4.2 * 0.97 ** 10);
    expect(spawnInterval(500)).toBe(1.4);
  });

  it('an untouched board eventually overflows', () => {
    const g = new RushGame(2);
    while (!g.over && g.time < 2000) g.tick(0.5);
    expect(g.over).toBe('overflow');
    expect(g.pressure()).toBeGreaterThanOrEqual(RUSH.overflowDensity);
  });

  it('is deterministic for a seed', () => {
    const run = (): number[] => {
      const g = new RushGame(77);
      const out: number[] = [];
      for (let i = 0; i < 200 && !g.over; i++) {
        g.tick(0.25);
        const f = freeArrows(g.grid)[0];
        if (f && i % 3 === 0) g.tap(f.id);
        out.push(g.score, g.grid.size);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});
