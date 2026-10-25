// Renders the original SVG artwork in resources/ to the PNG inputs that
// @capacitor/assets expects, plus the web/PWA icons in public/icons/.
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const res = (f) => new URL(`../resources/${f}`, import.meta.url);
const pub = (f) => new URL(`../public/${f}`, import.meta.url);

async function render(src, dest, size) {
  const svg = await readFile(res(src));
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(dest.pathname);
  console.log(`  ${src} -> ${dest.pathname} (${size}px)`);
}

await mkdir(pub('icons/'), { recursive: true });

// @capacitor/assets inputs (custom mode: icon-only, foreground, background, splash, splash-dark).
await render('icon.svg', res('icon-only.png'), 1024);
await render('icon-foreground.svg', res('icon-foreground.png'), 1024);
await render('icon-background.svg', res('icon-background.png'), 1024);
await render('splash.svg', res('splash.png'), 2732);
await render('splash.svg', res('splash-dark.png'), 2732);

// Web / PWA icons.
await render('icon.svg', pub('icons/icon-192.png'), 192);
await render('icon.svg', pub('icons/icon-512.png'), 512);
await render('icon.svg', pub('icons/maskable-512.png'), 512);
await render('icon.svg', pub('icons/apple-touch-icon.png'), 180);
