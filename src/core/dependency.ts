import type { Grid } from './grid.ts';
import { laneHits, laneIds } from './rules.ts';
import { type Arrow, head } from './types.ts';

/*
 * Arrow A depends on arrow B when B occupies any cell of A's exit lane (head
 * to board edge). A board is solvable iff this graph has no cycle: in a DAG
 * some arrow has no dependencies, so it is free; removing it keeps a DAG.
 */

export type Candidate = Pick<Arrow, 'cells' | 'dir'>;

/** Ids of existing arrows whose exit lane passes through any of the candidate's cells. */
export function dependentsOf(grid: Grid, cand: Candidate): number[] {
  const out: number[] = [];
  for (const a of grid.arrows.values()) {
    const h = head(a);
    if (cand.cells.some((c) => laneHits(h, a.dir, c))) out.push(a.id);
  }
  return out;
}

/** Would adding `cand` to the (acyclic) grid create a dependency cycle? */
export function wouldCreateCycle(grid: Grid, cand: Candidate): boolean {
  const deps = laneIds(grid, cand);
  if (deps.length === 0) return false;
  const dependents = new Set(dependentsOf(grid, cand));
  if (dependents.size === 0) return false;
  // Cycle iff some dependency of the candidate can reach one of its dependents.
  const seen = new Set<number>();
  const stack = [...deps];
  while (stack.length > 0) {
    const id = stack.pop() as number;
    if (dependents.has(id)) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const a = grid.arrows.get(id);
    if (a) stack.push(...laneIds(grid, a));
  }
  return false;
}

/**
 * Length of the longest dependency chain (number of arrows that must be
 * cleared in sequence). Empty board = 0. Assumes the graph is acyclic.
 */
export function longestChain(grid: Grid): number {
  const depth = new Map<number, number>();
  const visit = (id: number): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const a = grid.arrows.get(id);
    if (!a) return 0;
    let d = 0;
    for (const dep of laneIds(grid, a)) d = Math.max(d, visit(dep));
    depth.set(id, d + 1);
    return d + 1;
  };
  let best = 0;
  for (const id of grid.arrows.keys()) best = Math.max(best, visit(id));
  return best;
}

export function isAcyclic(grid: Grid): boolean {
  const state = new Map<number, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (id: number): boolean => {
    const s = state.get(id);
    if (s === 1) return false;
    if (s === 2) return true;
    state.set(id, 1);
    const a = grid.arrows.get(id);
    if (a) for (const dep of laneIds(grid, a)) if (!visit(dep)) return false;
    state.set(id, 2);
    return true;
  };
  for (const id of grid.arrows.keys()) if (!visit(id)) return false;
  return true;
}
