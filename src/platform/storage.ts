import { Preferences } from '@capacitor/preferences';
import { isNative } from './native.ts';

/*
 * Tiny JSON key-value store. Native uses @capacitor/preferences (survives
 * WebView storage eviction); web uses localStorage. Reads are served from an
 * in-memory cache loaded once at startup, so game code can read synchronously.
 */

const PREFIX = 'fletchy.';
const cache = new Map<string, string>();

function webGet(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Private mode or quota: progress just won't persist.
  }
}

export async function loadStorage(keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    const value = isNative() ? (await Preferences.get({ key: PREFIX + key })).value : webGet(key);
    if (value !== null) cache.set(key, value);
  }
}

export function read<T>(key: string, fallback: T): T {
  const raw = cache.get(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  cache.set(key, raw);
  if (isNative()) void Preferences.set({ key: PREFIX + key, value: raw });
  else webSet(key, raw);
}
