import { describe, expect, it } from 'vitest';
import { hashString, mulberry32 } from '../../src/core/rng.ts';

describe('mulberry32', () => {
  it('matches golden values (guards determinism across Node versions)', () => {
    const r = mulberry32(1);
    expect([r.next(), r.next(), r.next()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it('same seed, same sequence', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('int stays in range', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const n = r.int(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
});

describe('hashString', () => {
  it('is stable', () => {
    expect(hashString('fletchy')).toBe(4117188588);
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
