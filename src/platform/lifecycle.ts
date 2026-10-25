import { App } from '@capacitor/app';
import { isNative } from './native.ts';

export interface LifecycleHandlers {
  /** App hidden or backgrounded. */
  onPause(): void;
  /** Android back button / gesture. Return false to let the app exit. */
  onBack(): boolean;
}

export function initLifecycle(h: LifecycleHandlers): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) h.onPause();
  });
  if (!isNative()) return;
  void App.addListener('pause', () => h.onPause());
  void App.addListener('backButton', () => {
    if (!h.onBack()) void App.exitApp();
  });
}
