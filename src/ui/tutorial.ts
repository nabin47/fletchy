import type { Board } from '../core/types.ts';
import type { StringKey } from './strings.ts';

/** Three tiny scripted boards (about 30 seconds total). No hearts are lost here. */
export const TUTORIAL: { board: Board; text: StringKey }[] = [
  {
    text: 'tut1',
    board: { cols: 5, rows: 5, arrows: [{ id: 1, dir: 'R', cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }] }] },
  },
  {
    text: 'tut2',
    board: {
      cols: 5,
      rows: 5,
      arrows: [
        { id: 1, dir: 'R', cells: [{ x: 0, y: 2 }, { x: 1, y: 2 }] },
        { id: 2, dir: 'U', cells: [{ x: 3, y: 3 }, { x: 3, y: 2 }] },
      ],
    },
  },
  {
    text: 'tut3',
    board: {
      cols: 5,
      rows: 5,
      arrows: [
        { id: 1, dir: 'D', cells: [{ x: 1, y: 0 }, { x: 1, y: 1 }] },
        { id: 2, dir: 'L', cells: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }] },
        { id: 3, dir: 'U', cells: [{ x: 0, y: 4 }, { x: 0, y: 3 }] },
        { id: 4, dir: 'R', cells: [{ x: 3, y: 1 }] },
      ],
    },
  },
];
