import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNative } from './native.ts';

/** Light status/navigation bar icons on the dark theme, dark icons on the light theme. */
export function setSystemBarsDark(dark: boolean): void {
  if (isNative()) void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
}
