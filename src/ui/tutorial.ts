import type { Board } from '../core/types.ts';
import type { StringKey } from './strings.ts';

/** Three small scripted lessons (about 30 seconds total). No hearts are lost here. */
export const TUTORIAL: { board: Board; text: StringKey }[] = [
  {
    text: 'tut1',
    board: { cols: 7, rows: 9, arrows: [{ id: 1, dir: 'R', cells: [{ x: 2, y: 4 }, { x: 3, y: 4 }] }] },
  },
  {
    text: 'tut2',
    board: {
      cols: 7,
      rows: 9,
      arrows: [
        { id: 1, dir: 'R', cells: [{ x: 1, y: 4 }, { x: 2, y: 4 }] },
        { id: 2, dir: 'U', cells: [{ x: 4, y: 5 }, { x: 4, y: 4 }] },
      ],
    },
  },
  {
    text: 'tut3',
    board: {
      cols: 7,
      rows: 9,
      arrows: [
        { id: 1, dir: 'D', cells: [{ x: 2, y: 2 }, { x: 2, y: 3 }] },
        { id: 2, dir: 'L', cells: [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }] },
        { id: 3, dir: 'U', cells: [{ x: 1, y: 6 }, { x: 1, y: 5 }] },
        { id: 4, dir: 'R', cells: [{ x: 4, y: 3 }] },
      ],
    },
  },
];
