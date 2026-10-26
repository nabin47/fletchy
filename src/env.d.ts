declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;
declare const __APP_WEB_URL__: string;
declare const __APP_AUTHOR__: { name: string; intro: string; github: string };

/** Test hook used by the Playwright smoke test (window.__fletchy.debug). */
interface FletchyDebug {
  screen(): string;
  /** Same as the Android back button; false means the app would exit. */
  back(): boolean;
  /** Fast-forward a Rush game (waves spawn as if time passed). */
  advance(seconds: number): void;
  startRush(seed?: number): void;
  startDaily(): void;
  startLevel(level?: number): void;
  skipTutorial(): void;
  freeArrowCenter(): { x: number; y: number } | null;
  tapFree(): boolean;
  tapBlocked(): boolean;
  state(): { kind: string; score: number; hearts: number; arrows: number; over: string | null };
}

interface Window {
  __fletchy?: { ready: boolean; version: string; debug?: FletchyDebug };
}
