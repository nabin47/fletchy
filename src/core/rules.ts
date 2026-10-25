import { EMPTY, type Grid } from './grid.ts';
import { type Arrow, type Cell, DIR_VEC, type Dir, head } from './types.ts';

/** Cells from just past the head to the board edge, in travel order. */
export function laneCells(grid: Grid, h: Cell, dir: Dir): Cell[] {
  const v = DIR_VEC[dir];
  const out: Cell[] = [];
  for (let x = h.x + v.x, y = h.y + v.y; grid.inBounds(x, y); x += v.x, y += v.y) out.push({ x, y });
  return out;
}

/** Distinct ids of other arrows in this arrow's exit lane (its dependencies), nearest first. */
export function laneIds(grid: Grid, arrow: Pick<Arrow, 'cells' | 'dir'> & { id?: number }): number[] {
  const ids: number[] = [];
  for (const c of laneCells(grid, head(arrow as Arrow), arrow.dir)) {
    const id = grid.at(c.x, c.y);
    if (id !== EMPTY && id !== arrow.id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The nearest arrow blocking this one, or null if its lane is clear. */
export function firstBlocker(grid: Grid, arrow: Arrow): number | null {
  return laneIds(grid, arrow)[0] ?? null;
}

export function isFree(grid: Grid, arrow: Arrow): boolean {
  return firstBlocker(grid, arrow) === null;
}

export function freeArrows(grid: Grid): Arrow[] {
  return [...grid.arrows.values()].filter((a) => isFree(grid, a));
}

/** True if `cell` lies in the exit lane of an arrow whose head is `h` moving `dir`. */
export function laneHits(h: Cell, dir: Dir, cell: Cell): boolean {
  switch (dir) {
    case 'U':
      return cell.x === h.x && cell.y < h.y;
    case 'D':
      return cell.x === h.x && cell.y > h.y;
    case 'L':
      return cell.y === h.y && cell.x < h.x;
    case 'R':
      return cell.y === h.y && cell.x > h.x;
  }
}
