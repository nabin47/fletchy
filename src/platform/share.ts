import { Share } from '@capacitor/share';
import { isNative } from './native.ts';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Native share sheet, then Web Share API, then clipboard. */
export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    if (isNative()) {
      await Share.share({ text });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (err) {
    // User cancelled the sheet: not an error worth a fallback.
    if (err instanceof Error && err.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
