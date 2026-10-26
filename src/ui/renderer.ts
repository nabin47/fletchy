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
  private baseCell = 40;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
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
    this.baseCell = Math.max(8, Math.min((this.w - pad * 2) / this.cols, (this.h - pad * 2) / this.rows));
    this.zoom = Math.min(this.zoom, this.maxZoom());
    this.cell = this.baseCell * this.zoom;
    // When zoomed in, the board may be panned until its edge reaches the view edge (plus a margin).
    const clamp = (pan: number, board: number, view: number): number => {
      const limit = Math.max(0, (board - view) / 2 + pad * 2);
      return Math.max(-limit, Math.min(limit, pan));
    };
    this.panX = clamp(this.panX, this.cell * this.cols, this.w);
    this.panY = clamp(this.panY, this.cell * this.rows, this.h);
    this.ox = (this.w - this.cell * this.cols) / 2 + this.panX;
    this.oy = (this.h - this.cell * this.rows) / 2 + this.panY;
  }

  // ---------- zoom and pan ----------

  /** Big boards can zoom further: up to about 80 px cells, at least 1.5x, at most 3x. */
  maxZoom(): number {
    return Math.max(1.5, Math.min(3, 80 / this.baseCell));
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** Zoom by `factor`, keeping the board point under (clientX, clientY) in place. */
  zoomAt(factor: number, clientX?: number, clientY?: number): void {
    const r = this.canvas.getBoundingClientRect();
    const px = clientX === undefined ? this.w / 2 : clientX - r.left;
    const py = clientY === undefined ? this.h / 2 : clientY - r.top;
    const fx = (px - this.ox) / this.cell;
    const fy = (py - this.oy) / this.cell;
    this.zoom = Math.max(1, Math.min(this.maxZoom(), this.zoom * factor));
    const cell = this.baseCell * this.zoom;
    this.panX = px - fx * cell - (this.w - cell * this.cols) / 2;
    this.panY = py - fy * cell - (this.h - cell * this.rows) / 2;
    if (this.zoom === 1) this.panX = this.panY = 0;
    this.layout();
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.layout();
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = this.panY = 0;
    this.layout();
  }

  /** Pan so a cell is on screen (used when a hint points somewhere off view). */
  reveal(c: Cell): void {
    const p = this.center(c);
    const margin = this.cell;
    if (p.x >= margin && p.x <= this.w - margin && p.y >= margin && p.y <= this.h - margin) return;
    this.panBy(this.w / 2 - p.x, this.h / 2 - p.y);
  }

  /** Viewport point of a cell centre (for tests and tutorials). */
  cellCenterClient(c: Cell): Pt {
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

  private center(c: Cell): Pt {
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
      // The arrow travels along its own path and out past the board edge at a
      // speed the eye can follow. This is the core feedback of a tap, so it
      // stays (faster) with reduced motion; only shake and particles go.
      const exit = this.exitDistance(arrow);
      const duration = Math.min(0.9, 0.22 + exit / (this.cell * 30)) * (this.reducedMotion ? 0.6 : 1);
      const t = (now - t0) / duration;
      if (t >= 1) return false;
      const eased = 0.35 * t + 0.65 * t * t;
      this.drawArrow(arrow, eased * exit, 1, pal.ink, t < 0.8 ? 1 : (1 - t) / 0.2);
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
    let offset = 0;
    const b0 = this.bumps.get(a.id);
    if (b0 !== undefined) {
      const t = (now - b0) / BUMP_TIME;
      if (t >= 1) this.bumps.delete(a.id);
      else if (!this.reducedMotion) offset = Math.sin(t * Math.PI) * this.cell * 0.22;
    }
    let scale = 1;
    const s0 = this.spawns.get(a.id);
    if (s0 !== undefined) {
      const t = (now - s0) / SPAWN_TIME;
      if (t >= 1) this.spawns.delete(a.id);
      else scale = this.reducedMotion ? 1 : Math.max(0.01, easeOutBack(t));
    }
    let color = this.palette.ink;
    let alpha = 1;
    if (this.hintId === a.id) {
      color = this.palette.accent;
      alpha = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(now * 8);
    }
    const f0 = this.flashes.get(a.id);
    if (f0 !== undefined) {
      const t = (now - f0) / FLASH_TIME;
      if (t >= 1) this.flashes.delete(a.id);
      else if (Math.floor(t * 6) % 2 === 0) color = this.palette.danger;
    }
    this.drawArrow(a, offset, scale, color, alpha);
  }

  private bounds(a: Arrow): { x0: number; y0: number; x1: number; y1: number } {
    const s = this.cell;
    const xs = a.cells.map((c) => c.x);
    const ys = a.cells.map((c) => c.y);
    return {
      x0: this.ox + Math.min(...xs) * s,
      y0: this.oy + Math.min(...ys) * s,
      x1: this.ox + (Math.max(...xs) + 1) * s,
      y1: this.oy + (Math.max(...ys) + 1) * s,
    };
  }

  /**
   * The arrow's travel path in pixels: a short tail stub, every cell centre
   * (tail to head), then straight on past the board edge. Drawing a window of
   * the arrow's length that slides along this path gives snake-like motion.
   */
  private travelPath(a: Arrow): { pts: Pt[]; length: number } {
    const s = this.cell;
    const centres = a.cells.map((c) => this.center(c));
    const v = DIR_VEC[a.dir];
    const first = centres[0] as Pt;
    const second = centres[1];
    const back = second ? { x: Math.sign(first.x - second.x), y: Math.sign(first.y - second.y) } : { x: -v.x, y: -v.y };
    const tail = { x: first.x + back.x * s * 0.32, y: first.y + back.y * s * 0.32 };
    const h = centres[centres.length - 1] as Pt;
    const far = (Math.max(this.cols, this.rows) + a.cells.length + 4) * s;
    const pts = [tail, ...centres, { x: h.x + v.x * far, y: h.y + v.y * far }];
    let length = 0;
    for (let i = 1; i < centres.length + 1; i++) length += dist(pts[i - 1] as Pt, pts[i] as Pt);
    return { pts, length };
  }

  /** How far (px) an arrow must travel along its path until its tail has left the board. */
  private exitDistance(a: Arrow): number {
    const h = head(a);
    const v = DIR_VEC[a.dir];
    const toEdge = v.x > 0 ? this.cols - h.x : v.x < 0 ? h.x + 1 : v.y > 0 ? this.rows - h.y : h.y + 1;
    return (toEdge + a.cells.length + 0.6) * this.cell;
  }

  /** A thin line through the arrow's cells with a small head. The head shape shows direction. */
  private drawArrow(a: Arrow, offset: number, scale: number, color: string, alpha: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const { pts, length } = this.travelPath(a);
    const body = slice(pts, offset, offset + length);
    if (body.length < 2) return;
    const tip = body[body.length - 1] as Pt;
    const prev = body[body.length - 2] as Pt;
    const d = dist(prev, tip) || 1;
    const v = { x: (tip.x - prev.x) / d, y: (tip.y - prev.y) / d };
    const px = -v.y;
    const py = v.x;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (scale !== 1) {
      const { x0, y0, x1, y1 } = this.bounds(a);
      ctx.translate((x0 + x1) / 2, (y0 + y1) / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.min(5, Math.max(2, s * 0.09));
    ctx.beginPath();
    ctx.moveTo((body[0] as Pt).x, (body[0] as Pt).y);
    for (const p of body.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    const hx = tip.x + v.x * s * 0.3;
    const hy = tip.y + v.y * s * 0.3;
    const bx = tip.x - v.x * s * 0.02;
    const by = tip.y - v.y * s * 0.02;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(bx + px * s * 0.22, by + py * s * 0.22);
    ctx.lineTo(bx - px * s * 0.22, by - py * s * 0.22);
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

type Pt = { x: number; y: number };

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The part of a polyline between arc lengths `from` and `to`. */
function slice(pts: Pt[], from: number, to: number): Pt[] {
  const out: Pt[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    const len = dist(a, b);
    const s0 = acc;
    const s1 = acc + len;
    acc = s1;
    if (s1 < from || len === 0) continue;
    const at = (t: number): Pt => ({ x: a.x + ((b.x - a.x) * (t - s0)) / len, y: a.y + ((b.y - a.y) * (t - s0)) / len });
    if (out.length === 0) out.push(at(Math.max(from, s0)));
    if (s1 >= to) {
      out.push(at(to));
      break;
    }
    out.push(b);
  }
  return out;
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
