export type Dir = 'U' | 'D' | 'L' | 'R';

/** Grid coordinates: x is the column (0 = left), y is the row (0 = top). */
export interface Cell {
  x: number;
  y: number;
}

/**
 * A run of cells moving in `dir`. The head is the LAST cell. Cells are kept
 * generic (not just start + length) so bent "snake" arrows can be added later.
 */
export interface Arrow {
  id: number;
  cells: Cell[];
  dir: Dir;
}

/** Plain, serializable board snapshot. */
export interface Board {
  cols: number;
  rows: number;
  arrows: Arrow[];
}

export const DIRS: readonly Dir[] = ['U', 'D', 'L', 'R'];

export const DIR_VEC: Readonly<Record<Dir, Cell>> = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

export function head(arrow: Arrow): Cell {
  const h = arrow.cells[arrow.cells.length - 1];
  if (!h) throw new Error(`arrow ${arrow.id} has no cells`);
  return h;
}
