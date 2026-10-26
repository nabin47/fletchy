import type { Grid } from '../core/grid.ts';
import { type Arrow, type Cell, DIR_VEC, head } from '../core/types.ts';
import type { Palette } from './theme.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  t0: number;
}

const CLEAR_TIME = 0.3;
const BUMP_TIME = 0.28;
const FLASH_TIME = 0.45;
const SPAWN_TIME = 0.22;
const SHAKE_TIME = 0.25;
const POPUP_TIME = 0.8;

const easeOutBack = (t: number): number => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/** Canvas 2D board renderer. Owns only visual state (animations, particles). */
export class Renderer {
  palette: Palette;
  reducedMotion = false;
  hintId: number | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private cell = 40;
  private ox = 0;
  private oy = 0;
  private cols = 1;
  private rows = 1;
  private lastDraw = 0;
  private clears: { arrow: Arrow; t0: number }[] = [];
  private bumps = new Map<number, number>();
  private flashes = new Map<number, number>();
  private spawns = new Map<number, number>();
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private shakeT0 = -Infinity;

  constructor(canvas: HTMLCanvasElement, palette: Palette) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.palette = palette;
  }

  /** Size in CSS pixels; the backing store is scaled for devicePixelRatio. */
  resize(width: number, height: number): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.w = width;
    this.h = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  }

  setBoardSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.layout();
  }

  private layout(): void {
    const pad = 8;
    this.cell = Math.max(8, Math.floor(Math.min((this.w - pad * 2) / this.cols, (this.h - pad * 2) / this.rows)));
    this.ox = Math.round((this.w - this.cell * this.cols) / 2);
    this.oy = Math.round((this.h - this.cell * this.rows) / 2);
  }

  /** Viewport point of a cell centre (for tests and tutorials). */
  cellCenterClient(c: Cell): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + this.ox + (c.x + 0.5) * this.cell, y: r.top + this.oy + (c.y + 0.5) * this.cell };
  }

  reset(): void {
    this.clears = [];
    this.bumps.clear();
    this.flashes.clear();
    this.spawns.clear();
    this.particles = [];
    this.popups = [];
    this.hintId = null;
  }

  private center(c: Cell): { x: number; y: number } {
    return { x: this.ox + (c.x + 0.5) * this.cell, y: this.oy + (c.y + 0.5) * this.cell };
  }

  onClear(arrow: Arrow, now: number, popup?: string): void {
    this.clears.push({ arrow, t0: now });
    if (this.hintId === arrow.id) this.hintId = null;
    const p = this.center(head(arrow));
    if (popup) this.popups.push({ text: popup, x: p.x, y: p.y, t0: now });
    if (this.reducedMotion) return;
    const color = this.palette.ink;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this.cell * (1.5 + Math.random() * 3);
      this.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.3, color });
    }
  }

  onBump(arrow: Arrow, blockerId: number, now: number): void {
    this.bumps.set(arrow.id, now);
    this.flashes.set(blockerId, now);
    if (!this.reducedMotion) this.shakeT0 = now;
  }

  onSpawn(arrows: readonly Arrow[], now: number): void {
    for (const a of arrows) this.spawns.set(a.id, now);
  }

  draw(grid: Grid | null, now: number): void {
    const dt = Math.min(0.1, Math.max(0, now - this.lastDraw));
    this.lastDraw = now;
    const ctx = this.ctx;
    const pal = this.palette;
    ctx.save();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const shake = now - this.shakeT0;
    if (shake < SHAKE_TIME) {
      const k = (1 - shake / SHAKE_TIME) * 6;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }

    if (grid) {
      this.drawBoard();
      for (const a of grid.arrows.values()) this.drawLiveArrow(a, now);
    }

    this.clears = this.clears.filter(({ arrow, t0 }) => {
      const t = (now - t0) / (this.reducedMotion ? CLEAR_TIME / 2 : CLEAR_TIME);
      if (t >= 1) return false;
      const v = DIR_VEC[arrow.dir];
      const dist = this.reducedMotion ? 0 : (Math.max(this.cols, this.rows) + 3) * this.cell * t * t;
      this.drawArrow(arrow, v.x * dist, v.y * dist, 1, pal.ink, 1 - t * t);
      return true;
    });

    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) return false;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
      ctx.globalAlpha = 0.5 * (1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;

    this.popups = this.popups.filter((p) => {
      const t = (now - p.t0) / POPUP_TIME;
      if (t >= 1) return false;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = pal.muted;
      ctx.font = `600 ${Math.round(this.cell * 0.34)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y - t * this.cell * (this.reducedMotion ? 0 : 0.9));
      return true;
    });
    ctx.restore();
  }

  private drawBoard(): void {
    const ctx = this.ctx;
    const s = this.cell;
    ctx.fillStyle = this.palette.panel;
    roundRect(ctx, this.ox - 6, this.oy - 6, this.cols * s + 12, this.rows * s + 12, 12);
    ctx.fill();
    ctx.fillStyle = this.palette.dot;
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) {
        ctx.beginPath();
        ctx.arc(this.ox + (x + 0.5) * s, this.oy + (y + 0.5) * s, Math.max(1, s * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
  }

  private drawLiveArrow(a: Arrow, now: number): void {
    const v = DIR_VEC[a.dir];
    let dx = 0;
    let dy = 0;
    const b0 = this.bumps.get(a.id);
    if (b0 !== undefined) {
      const t = (now - b0) / BUMP_TIME;
      if (t >= 1) this.bumps.delete(a.id);
      else if (!this.reducedMotion) {
        const k = Math.sin(t * Math.PI) * this.cell * 0.22;
        dx = v.x * k;
        dy = v.y * k;
      }
    }
    let scale = 1;
    const s0 = this.spawns.get(a.id);
    if (s0 !== undefined) {
      const t = (now - s0) / SPAWN_TIME;
      if (t >= 1) this.spawns.delete(a.id);
      else scale = this.reducedMotion ? 1 : Math.max(0.01, easeOutBack(t));
    }
    let color = this.palette.ink;
    const f0 = this.flashes.get(a.id);
    if (f0 !== undefined) {
      const t = (now - f0) / FLASH_TIME;
      if (t >= 1) this.flashes.delete(a.id);
      else if (Math.floor(t * 6) % 2 === 0) color = this.palette.danger;
    }
    if (this.hintId === a.id) this.drawHint(a, now);
    this.drawArrow(a, dx, dy, scale, color, 1);
  }

  private drawHint(a: Arrow, now: number): void {
    const ctx = this.ctx;
    const { x0, y0, x1, y1 } = this.bounds(a);
    const pulse = this.reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(now * 8);
    ctx.save();
    ctx.strokeStyle = this.palette.accent;
    ctx.globalAlpha = 0.35 + 0.55 * pulse;
    ctx.lineWidth = 2;
    roundRect(ctx, x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4, this.cell * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  private bounds(a: Arrow): { x0: number; y0: number; x1: number; y1: number } {
    const s = this.cell;
    const inset = s * 0.08;
    const xs = a.cells.map((c) => c.x);
    const ys = a.cells.map((c) => c.y);
    return {
      x0: this.ox + Math.min(...xs) * s + inset,
      y0: this.oy + Math.min(...ys) * s + inset,
      x1: this.ox + (Math.max(...xs) + 1) * s - inset,
      y1: this.oy + (Math.max(...ys) + 1) * s - inset,
    };
  }

  /** Faint tile + thin shaft + arrowhead. The head shape always shows direction. */
  private drawArrow(a: Arrow, dx: number, dy: number, scale: number, color: string, alpha: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const v = DIR_VEC[a.dir];
    const { x0, y0, x1, y1 } = this.bounds(a);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(dx + (x0 + x1) / 2, dy + (y0 + y1) / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);

    // A barely-there tile shows the tappable extent without adding visual weight.
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.06;
    roundRect(ctx, x0, y0, x1 - x0, y1 - y0, s * 0.18);
    ctx.fill();
    ctx.globalAlpha = alpha;

    const first = a.cells[0] as Cell;
    const tail = this.center(first);
    const tip = this.center(head(a));
    const tailX = tail.x - v.x * s * 0.3;
    const tailY = tail.y - v.y * s * 0.3;
    const px = -v.y;
    const py = v.x;

    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, s * 0.075);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    const hx = tip.x + v.x * s * 0.3;
    const hy = tip.y + v.y * s * 0.3;
    const bx = tip.x - v.x * s * 0.04;
    const by = tip.y - v.y * s * 0.04;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(bx + px * s * 0.2, by + py * s * 0.2);
    ctx.lineTo(bx - px * s * 0.2, by - py * s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * The arrow under a viewport point. Cells are small, so a tap that lands on
   * an empty cell still picks the nearest arrow cell within `reach` cells.
   */
  arrowAt(grid: Grid, clientX: number, clientY: number, reach = 0.8): number | null {
    const r = this.canvas.getBoundingClientRect();
    const fx = (clientX - r.left - this.ox) / this.cell;
    const fy = (clientY - r.top - this.oy) / this.cell;
    const exact = grid.at(Math.floor(fx), Math.floor(fy));
    if (exact >= 0) return exact;
    let best: number | null = null;
    let bestD = reach;
    for (const a of grid.arrows.values())
      for (const c of a.cells) {
        const d = Math.hypot(fx - (c.x + 0.5), fy - (c.y + 0.5));
        if (d < bestD) {
          bestD = d;
          best = a.id;
        }
      }
    return best;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
