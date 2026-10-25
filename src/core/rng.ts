/** Seeded PRNG (mulberry32). Pure 32-bit integer math, so it is identical on every JS engine. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[int(items.length)] as T;
    },
  };
}

/** FNV-1a 32-bit hash of a string, used to turn dates and salts into seeds. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
