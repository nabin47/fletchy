import type { Dir } from '../core/types.ts';

export interface Palette {
  bg: string;
  panel: string;
  dot: string;
  text: string;
  dirs: Record<Dir, string>;
  danger: string;
  hint: string;
}

const DARK_BASE = { bg: '#14161f', panel: '#1c1f2b', dot: '#2c3142', text: '#f3f1ea', danger: '#ff4d5e', hint: '#ffffff' };
const LIGHT_BASE = { bg: '#f4f1ea', panel: '#ffffff', dot: '#dcd6c8', text: '#1b1d27', danger: '#d62839', hint: '#1b1d27' };

// Direction is always shown by the arrowhead shape; colour is a secondary cue.
const STANDARD: Record<Dir, string> = { U: '#ffb845', D: '#3ec7b5', L: '#ff6b5a', R: '#9b8cff' };
const STANDARD_LIGHT: Record<Dir, string> = { U: '#d98a00', D: '#108f80', L: '#e0442f', R: '#6a55e0' };
// Okabe-Ito colours, distinguishable with the common colour-vision deficiencies.
const COLORBLIND: Record<Dir, string> = { U: '#E69F00', D: '#56B4E9', L: '#F0E442', R: '#CC79A7' };
const COLORBLIND_LIGHT: Record<Dir, string> = { U: '#C17F00', D: '#0072B2', L: '#9A8A00', R: '#B0548C' };

export function palette(dark: boolean, colorblind: boolean): Palette {
  if (dark) return { ...DARK_BASE, dirs: colorblind ? COLORBLIND : STANDARD };
  return { ...LIGHT_BASE, dirs: colorblind ? COLORBLIND_LIGHT : STANDARD_LIGHT };
}
