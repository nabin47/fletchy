// Applies Fletchy's Android customizations (PLAN.md Section 6) to the
// Capacitor-generated android/ project. Idempotent: safe to run repeatedly.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SDK = { minSdkVersion: 24, compileSdkVersion: 36, targetSdkVersion: 36 };

function edit(path, fn) {
  if (!existsSync(path)) throw new Error(`${path} not found; run "npx cap add android" first`);
  const before = readFileSync(path, 'utf8');
  const after = fn(before);
  if (after !== before) {
    writeFileSync(path, after);
    console.log(`updated ${path}`);
  } else {
    console.log(`unchanged ${path}`);
  }
}

// SDK levels (Google Play requires target API 36 since 31 Aug 2026).
edit('android/variables.gradle', (src) => {
  let out = src;
  for (const [key, value] of Object.entries(SDK)) {
    const re = new RegExp(`(${key}\\s*=\\s*)\\d+`);
    if (!re.test(out)) throw new Error(`${key} missing from variables.gradle`);
    out = out.replace(re, `$1${value}`);
  }
  return out;
});

// Portrait lock on the main activity.
edit('android/app/src/main/AndroidManifest.xml', (src) => {
  if (src.includes('android:screenOrientation=')) return src;
  return src.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
});
