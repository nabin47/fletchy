import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// The Capacitor CLI always runs from the repo root, so a cwd-relative read is safe.
const app = JSON.parse(readFileSync('app.config.json', 'utf8')) as { appId: string; name: string; backgroundColor: string };

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.name,
  webDir: 'dist',
  backgroundColor: app.backgroundColor,
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Android 15+ (target 36) is always edge-to-edge. Capacitor injects --safe-area-inset-* CSS vars.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
};

export default config;
