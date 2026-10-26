import { type Candidate, longestChain, wouldCreateCycle } from './dependency.ts';
import { EMPTY, Grid } from './grid.ts';
import type { Rng } from './rng.ts';
import { laneCells } from './rules.ts';
import { type Arrow, type Board, type Cell, DIR_VEC, DIRS, type Dir, head } from './types.ts';

export interface PlacementOptions {
  /** Probability of a 2-cell arrow. */
  len2Prob: number;
  /** Probability of a 3-cell arrow (the rest are 1-cell). */
  len3Prob: number;
  /** 0..1: chance to pick the candidate that most lengthens the longest dependency chain. */
  chainBias: number;
  /** Valid candidates to compare when applying chainBias. */
  samples: number;
  /** Random attempts before falling back to an exhaustive scan. */
  attempts: number;
  /**
   * Bent ("snake") arrows: when set, candidates are random walks of up to
   * `maxLen` cells that turn with probability `bendProb` at each step.
   * Unset (the default) keeps straight 1-3 cell arrows.
   */
  snake?: { maxLen: number; bendProb: number };
}

export const DEFAULT_PLACEMENT: PlacementOptions = {
  len2Prob: 0.4,
  len3Prob: 0.2,
  chainBias: 0,
  samples: 6,
  attempts: 60,
};

/** Cells of a straight arrow with head `h`, body trailing behind it; head is last. */
export function straightCells(h: Cell, dir: Dir, length: number): Cell[] {
  const v = DIR_VEC[dir];
  const cells: Cell[] = [];
  for (let i = length - 1; i >= 0; i--) cells.push({ x: h.x - v.x * i, y: h.y - v.y * i });
  return cells;
}

function rollLength(rng: Rng, opts: PlacementOptions): number {
  const r = rng.next();
  if (r < opts.len3Prob) return 3;
  if (r < opts.len3Prob + opts.len2Prob) return 2;
  return 1;
}

/** An arrow whose exit lane runs through its own body would hit itself while sliding out. */
function laneCrossesSelf(grid: Grid, cand: Candidate): boolean {
  if (cand.cells.length < 3) return false;
  const lane = laneCells(grid, head(cand as Arrow), cand.dir);
  return lane.some((l) => cand.cells.some((c) => c.x === l.x && c.y === l.y));
}

function isValid(grid: Grid, cand: Candidate): boolean {
  return grid.canPlace(cand.cells) && !laneCrossesSelf(grid, cand) && !wouldCreateCycle(grid, cand);
}

const TURNS: Record<Dir, [Dir, Dir]> = { U: ['L', 'R'], D: ['L', 'R'], L: ['U', 'D'], R: ['U', 'D'] };

/**
 * A random walk over empty cells, tail first. The head points the way the
 * last step went, so the arrow keeps moving in the direction it is drawn.
 */
function randomSnake(grid: Grid, rng: Rng, maxLen: number, bendProb: number): Candidate | null {
  const start = { x: rng.int(grid.cols), y: rng.int(grid.rows) };
  if (grid.at(start.x, start.y) !== EMPTY) return null;
  const target = 2 + rng.int(Math.max(1, maxLen - 1));
  const cells: Cell[] = [start];
  let dir = rng.pick(DIRS);
  const free = (c: Cell): boolean =>
    grid.inBounds(c.x, c.y) && grid.at(c.x, c.y) === EMPTY && !cells.some((o) => o.x === c.x && o.y === c.y);
  while (cells.length < target) {
    const last = cells[cells.length - 1] as Cell;
    const [a, b] = TURNS[dir];
    const turn = rng.chance(0.5) ? [a, b] : [b, a];
    const order: Dir[] = rng.chance(bendProb) ? [...turn, dir] : [dir, ...turn];
    const next = order.map((d) => ({ d, c: { x: last.x + DIR_VEC[d].x, y: last.y + DIR_VEC[d].y } })).find((o) => free(o.c));
    if (!next) break;
    cells.push(next.c);
    dir = next.d;
  }
  return cells.length >= 2 ? { dir, cells } : null;
}

/** Every valid placement on the grid, in a fixed (deterministic) order. */
export function allValidPlacements(grid: Grid): Candidate[] {
  const out: Candidate[] = [];
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++)
      for (const dir of DIRS)
        for (let len = 1; len <= 3; len++) {
          const cand = { dir, cells: straightCells({ x, y }, dir, len) };
          if (isValid(grid, cand)) out.push(cand);
        }
  return out;
}

function chainWith(grid: Grid, cand: Candidate): number {
  const id = grid.allocId();
  grid.add({ id, ...cand });
  const chain = longestChain(grid);
  grid.remove(id);
  return chain;
}

/**
 * Inserts one arrow without creating a dependency cycle, so the board stays
 * solvable. Returns the new arrow, or null if no valid placement exists.
 */
export function placeArrow(grid: Grid, rng: Rng, opts: PlacementOptions = DEFAULT_PLACEMENT): Arrow | null {
  const found: Candidate[] = [];
  const want = opts.chainBias > 0 ? Math.max(1, opts.samples) : 1;
  for (let i = 0; i < opts.attempts && found.length < want; i++) {
    if (opts.snake) {
      const cand = randomSnake(grid, rng, opts.snake.maxLen, opts.snake.bendProb);
      if (cand && isValid(grid, cand)) found.push(cand);
      continue;
    }
    const dir = rng.pick(DIRS);
    const h = { x: rng.int(grid.cols), y: rng.int(grid.rows) };
    const cand = { dir, cells: straightCells(h, dir, rollLength(rng, opts)) };
    if (isValid(grid, cand)) found.push(cand);
  }
  if (found.length === 0) {
    const all = allValidPlacements(grid);
    if (all.length === 0) return null;
    found.push(rng.pick(all));
  }

  let chosen = found[0] as Candidate;
  if (found.length > 1 && rng.chance(opts.chainBias)) {
    let best = -1;
    for (const cand of found) {
      const c = chainWith(grid, cand);
      if (c > best) {
        best = c;
        chosen = cand;
      }
    }
  }
  const arrow: Arrow = { id: grid.allocId(), dir: chosen.dir, cells: chosen.cells };
  grid.add(arrow);
  return arrow;
}

export interface BoardSpec {
  cols: number;
  rows: number;
  /** Stop after this many arrows... */
  maxArrows?: number;
  /** ...or once this fraction of cells is filled (whichever comes first). */
  fill?: number;
  placement?: Partial<PlacementOptions>;
}

export function generateBoard(rng: Rng, spec: BoardSpec): Board {
  const grid = new Grid(spec.cols, spec.rows);
  fillGrid(grid, rng, spec);
  return grid.snapshot();
}

export function fillGrid(grid: Grid, rng: Rng, spec: Omit<BoardSpec, 'cols' | 'rows'>): void {
  const opts = { ...DEFAULT_PLACEMENT, ...spec.placement };
  const maxArrows = spec.maxArrows ?? Infinity;
  const fill = spec.fill ?? 1;
  while (grid.size < maxArrows && grid.density() < fill) {
    if (!placeArrow(grid, rng, opts)) break;
  }
}
