import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

interface AppConfig {
  name: string;
  storeTitle: string;
  appId: string;
  version: string;
  webUrl: string;
}

const app = JSON.parse(readFileSync(new URL('./app.config.json', import.meta.url), 'utf8')) as AppConfig;

// '/fletchy/' on GitHub Pages (set by pages.yml); '/' for local and Capacitor builds.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_NAME__: JSON.stringify(app.name),
    __APP_VERSION__: JSON.stringify(app.version),
    __APP_WEB_URL__: JSON.stringify(app.webUrl),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
