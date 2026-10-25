// Builds everything the Play Console listing needs into store/build/ from
// app.config.json, the SVG artwork and the Playwright store screenshots.
//   node scripts/make-store-assets.mjs              -> text + images
//   node scripts/make-store-assets.mjs --text-only  -> listing text + release notes only
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = new URL('store/build/', root);
const app = JSON.parse(await readFile(new URL('app.config.json', root), 'utf8'));
const textOnly = process.argv.includes('--text-only');

const LIMITS = { title: 30, short: 80, full: 4000, notes: 500 };
const check = (label, text, max) => {
  if (text.length > max) throw new Error(`${label} is ${text.length} chars (max ${max})`);
};
check('storeTitle', app.storeTitle, LIMITS.title);
check('shortDescription', app.store.shortDescription, LIMITS.short);
check('fullDescription', app.store.fullDescription, LIMITS.full);
check('releaseNotes', app.store.releaseNotes, LIMITS.notes);

await rm(out, { recursive: true, force: true });
await mkdir(new URL('listing/en-US/', out), { recursive: true });
await mkdir(new URL('whatsnew/', out), { recursive: true });
await writeFile(new URL('listing/en-US/title.txt', out), app.storeTitle);
await writeFile(new URL('listing/en-US/short_description.txt', out), app.store.shortDescription);
await writeFile(new URL('listing/en-US/full_description.txt', out), app.store.fullDescription);
// r0adkll/upload-google-play reads whatsnew-<locale> files from this folder.
await writeFile(new URL('whatsnew/whatsnew-en-US', out), app.store.releaseNotes);
console.log('wrote listing text and release notes');

if (!textOnly) await images();

async function images() {
  const { default: sharp } = await import('sharp');
  const FONT = "'Inter', 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif";
  const BG = app.backgroundColor;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const png = (svg, file, w, h) =>
    sharp(Buffer.from(svg), { density: 144 }).resize(w, h).flatten({ background: BG }).removeAlpha().png().toFile(new URL(file, out).pathname);

  // 512x512 hi-res icon (Play applies its own corner mask).
  await sharp(await readFile(new URL('resources/icon.svg', root)), { density: 300 })
    .resize(512, 512)
    .flatten({ background: BG })
    .removeAlpha()
    .png()
    .toFile(new URL('icon-512.png', out).pathname);

  // 1024x500 feature graphic: name and tagline left, a small arrow board right.
  const COLORS = { U: '#ffb845', D: '#3ec7b5', L: '#ff6b5a', R: '#9b8cff' };
  const VEC = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const cell = 78;
  const ox = 548;
  const oy = 55;
  const arrow = (x, y, len, dir) => {
    const [vx, vy] = VEC[dir];
    const cells = Array.from({ length: len }, (_, i) => [x + vx * i, y + vy * i]);
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const inset = cell * 0.08;
    const x0 = ox + Math.min(...xs) * cell + inset;
    const y0 = oy + Math.min(...ys) * cell + inset;
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * cell - inset * 2;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * cell - inset * 2;
    const ctr = (c) => [ox + (c[0] + 0.5) * cell, oy + (c[1] + 0.5) * cell];
    const [tx, ty] = ctr(cells[0]);
    const [hx, hy] = ctr(cells[cells.length - 1]);
    const tailX = tx - vx * cell * 0.3;
    const tailY = ty - vy * cell * 0.3;
    const [px, py] = [-vy, vx];
    const tip = [hx + vx * cell * 0.36, hy + vy * cell * 0.36];
    const base = [hx - vx * cell * 0.06, hy - vy * cell * 0.06];
    const c = COLORS[dir];
    return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${cell * 0.22}" fill="${c}" opacity="0.18"/>
      <line x1="${tailX}" y1="${tailY}" x2="${hx}" y2="${hy}" stroke="${c}" stroke-width="${cell * 0.14}" stroke-linecap="round"/>
      <polygon points="${tip.join(',')} ${base[0] + px * cell * 0.28},${base[1] + py * cell * 0.28} ${base[0] - px * cell * 0.28},${base[1] - py * cell * 0.28}" fill="${c}"/>`;
  };
  const dots = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) dots.push(`<circle cx="${ox + (x + 0.5) * cell}" cy="${oy + (y + 0.5) * cell}" r="4" fill="#2c3142"/>`);
  const board = [arrow(0, 0, 2, 'R'), arrow(3, 0, 2, 'D'), arrow(0, 4, 3, 'U'), arrow(1, 3, 3, 'R'), arrow(2, 1, 2, 'L'), arrow(4, 4, 1, 'U'), arrow(4, 2, 1, 'R')].join('');
  const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
    <rect width="1024" height="500" fill="${BG}"/>
    <rect x="${ox - 10}" y="${oy - 10}" width="${cell * 5 + 20}" height="${cell * 5 + 20}" rx="22" fill="#1c1f2b"/>
    ${dots.join('')}
    ${board}
    <text x="64" y="232" font-family="${FONT}" font-size="104" font-weight="800" fill="#f3f1ea">${esc(app.name)}</text>
    <text x="68" y="298" font-family="${FONT}" font-size="36" font-weight="600" fill="#ffb845">${esc(app.store.featureTagline)}</text>
  </svg>`;
  await png(feature, 'feature-graphic.png', 1024, 500);

  // Captioned phone screenshots, 1080x1920.
  await mkdir(new URL('screenshots/', out), { recursive: true });
  let n = 0;
  for (const { shot, caption } of app.store.screenshots) {
    const src = new URL(`test-results/store/${shot}.png`, root);
    if (!existsSync(src)) throw new Error(`missing ${src.pathname}: run the Playwright store test first`);
    const W = 1080;
    const H = 1920;
    const shotH = 1560;
    const shotW = Math.round((shotH * 1080) / 1920);
    const raw = await sharp(src.pathname).resize(shotW, shotH).toBuffer();
    const mask = Buffer.from(`<svg width="${shotW}" height="${shotH}"><rect width="${shotW}" height="${shotH}" rx="44" fill="#fff"/></svg>`);
    const rounded = await sharp(raw).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    // Up to two balanced lines, sized to fit the width (approximate glyph width 0.55em).
    const lines = wrap(caption, 22);
    const size = Math.min(76, Math.floor(960 / (Math.max(...lines.map((l) => l.length)) * 0.55)));
    const y0 = lines.length === 1 ? 190 : 150;
    const text = lines
      .map((l, i) => `<text x="${W / 2}" y="${y0 + i * size * 1.15}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="800" fill="#f3f1ea">${esc(l)}</text>`)
      .join('');
    const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${BG}"/>${text}
    </svg>`;
    n++;
    await sharp(Buffer.from(frame))
      .composite([{ input: rounded, left: Math.round((W - shotW) / 2), top: 300 }])
      .flatten({ background: BG })
      .removeAlpha()
      .png()
      .toFile(new URL(`screenshots/phone-${n}.png`, out).pathname);
  }
  console.log(`wrote icon-512.png, feature-graphic.png and ${n} screenshots`);
}

/** Splits text into one line, or two lines of similar length, if it is longer than `max`. */
function wrap(text, max) {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let best = [text];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [a, b];
    }
  }
  return best;
}
