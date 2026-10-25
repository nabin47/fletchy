import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './native.ts';

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

function vibrate(ms: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

export function tapHaptic(): void {
  if (!enabled) return;
  if (isNative()) void Haptics.impact({ style: ImpactStyle.Light });
  else vibrate(8);
}

export function errorHaptic(): void {
  if (!enabled) return;
  if (isNative()) void Haptics.notification({ type: NotificationType.Error });
  else vibrate([30, 40, 30]);
}

export function successHaptic(): void {
  if (!enabled) return;
  if (isNative()) void Haptics.notification({ type: NotificationType.Success });
  else vibrate(20);
}
