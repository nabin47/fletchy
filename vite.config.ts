import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

interface AppConfig {
  name: string;
  storeTitle: string;
  appId: string;
  version: string;
  repo: string;
  webUrl: string;
  themeColor: string;
  backgroundColor: string;
  store: { shortDescription: string };
}

const app = JSON.parse(readFileSync(new URL('./app.config.json', import.meta.url), 'utf8')) as AppConfig;

// '/fletchy/' on GitHub Pages (set by pages.yml); '/' for local and Capacitor builds.
const base = process.env.VITE_BASE ?? '/';

function manifest(): string {
  // Paths are relative to the manifest URL, so they work under any base path.
  return JSON.stringify(
    {
      name: app.name,
      short_name: app.name,
      description: app.store.shortDescription,
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: app.backgroundColor,
      theme_color: app.themeColor,
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
}

function privacy(): string {
  return readFileSync(new URL('./resources/privacy.template.html', import.meta.url), 'utf8')
    .replaceAll('{{name}}', app.name)
    .replaceAll('{{repo}}', app.repo);
}

/** Emits the web manifest, privacy page and a precaching service worker (no extra dependency). */
function webApp(): Plugin {
  return {
    name: 'fletchy-web-app',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('/manifest.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json').end(manifest());
        else if (req.url?.endsWith('/privacy.html')) res.setHeader('Content-Type', 'text/html').end(privacy());
        else next();
      });
    },
    generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() });
      this.emitFile({ type: 'asset', fileName: 'privacy.html', source: privacy() });
      const files = ['./', 'index.html', 'manifest.webmanifest', 'privacy.html', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', ...Object.keys(bundle)];
      const version = `${app.version}-${Object.keys(bundle).sort().join('|').length}-${Date.now().toString(36)}`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker([...new Set(files)], version) });
    },
  };
}

function serviceWorker(files: string[], version: string): string {
  return `// Generated at build time. Precaches the whole game so it works offline.
const CACHE = ${JSON.stringify(`fletchy-${version}`)};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match('./'))),
  );
});
`;
}

export default defineConfig({
  base,
  define: {
    __APP_NAME__: JSON.stringify(app.name),
    __APP_VERSION__: JSON.stringify(app.version),
    __APP_WEB_URL__: JSON.stringify(app.webUrl),
  },
  plugins: [webApp()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
