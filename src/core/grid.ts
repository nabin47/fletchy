import type { Arrow, Board, Cell } from './types.ts';

export const EMPTY = -1;

/** Mutable board with an occupancy index for O(1) cell lookups. */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly arrows = new Map<number, Arrow>();
  private readonly occ: Int32Array;
  private nextId = 1;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.occ = new Int32Array(cols * rows).fill(EMPTY);
  }

  static from(board: Board): Grid {
    const g = new Grid(board.cols, board.rows);
    for (const a of board.arrows) g.add(a);
    return g;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  /** Arrow id at a cell, or EMPTY. Out-of-bounds cells read as EMPTY. */
  at(x: number, y: number): number {
    return this.inBounds(x, y) ? (this.occ[y * this.cols + x] as number) : EMPTY;
  }

  canPlace(cells: readonly Cell[]): boolean {
    return cells.every((c) => this.inBounds(c.x, c.y) && this.at(c.x, c.y) === EMPTY);
  }

  allocId(): number {
    return this.nextId++;
  }

  add(arrow: Arrow): void {
    if (this.arrows.has(arrow.id)) throw new Error(`duplicate arrow id ${arrow.id}`);
    if (!this.canPlace(arrow.cells)) throw new Error(`arrow ${arrow.id} overlaps or is out of bounds`);
    for (const c of arrow.cells) this.occ[c.y * this.cols + c.x] = arrow.id;
    this.arrows.set(arrow.id, arrow);
    this.nextId = Math.max(this.nextId, arrow.id + 1);
  }

  remove(id: number): Arrow | undefined {
    const arrow = this.arrows.get(id);
    if (!arrow) return undefined;
    for (const c of arrow.cells) this.occ[c.y * this.cols + c.x] = EMPTY;
    this.arrows.delete(id);
    return arrow;
  }

  get size(): number {
    return this.arrows.size;
  }

  occupiedCells(): number {
    let n = 0;
    for (const a of this.arrows.values()) n += a.cells.length;
    return n;
  }

  /** Fraction of cells covered by arrows, 0..1. */
  density(): number {
    return this.occupiedCells() / (this.cols * this.rows);
  }

  snapshot(): Board {
    return {
      cols: this.cols,
      rows: this.rows,
      arrows: [...this.arrows.values()].map((a) => ({ id: a.id, dir: a.dir, cells: a.cells.map((c) => ({ ...c })) })),
    };
  }
}
