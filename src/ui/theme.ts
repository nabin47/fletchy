/*
 * Minimal palette: one ink colour for every arrow (the arrowhead shape shows
 * direction), one muted accent, a muted red reserved for mistakes. Light is
 * a soft warm off-white; dark is a soft charcoal, never pure black or white.
 */
export interface Palette {
  bg: string;
  panel: string;
  dot: string;
  ink: string;
  muted: string;
  accent: string;
  danger: string;
}

const LIGHT: Palette = {
  bg: '#f4f2ee',
  panel: '#fbfaf7',
  dot: '#dcd8cf',
  ink: '#34363c',
  muted: '#8b8d93',
  accent: '#5e8578',
  danger: '#c0594f',
};

const DARK: Palette = {
  bg: '#1c1d21',
  panel: '#232429',
  dot: '#383a41',
  ink: '#d6d3cb',
  muted: '#8b8d94',
  accent: '#8fb5a8',
  danger: '#d97a70',
};

export function palette(dark: boolean): Palette {
  return dark ? DARK : LIGHT;
}
