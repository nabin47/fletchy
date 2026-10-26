import './style.css';
import { loadStorage } from './platform/storage.ts';
import { isNative } from './platform/native.ts';
import { FletchyApp } from './ui/app.ts';
import { STORAGE_KEYS } from './ui/progress.ts';
import { setLanguage } from './ui/strings.ts';

async function boot(): Promise<void> {
  setLanguage(navigator.language || 'en');
  await loadStorage(STORAGE_KEYS);
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const app = new FletchyApp(root, { name: __APP_NAME__, version: __APP_VERSION__, webUrl: __APP_WEB_URL__, author: __APP_AUTHOR__ });
  window.__fletchy = { ready: true, version: __APP_VERSION__, debug: app.debugApi() };

  // Offline support on the web build only; native apps already load from the device.
  if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Offline caching is a nice-to-have; the game still works online.
    });
  }
}

void boot();
