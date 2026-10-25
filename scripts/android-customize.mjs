// Applies Fletchy's Android customizations (PLAN.md Section 6) to the
// Capacitor-generated android/ project. Idempotent: safe to run repeatedly
// (bootstrap.yml runs it on a fresh project; it is a no-op on the committed one).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SDK = { minSdkVersion: 24, compileSdkVersion: 36, targetSdkVersion: 36 };

function edit(path, fn) {
  if (!existsSync(path)) throw new Error(`${path} not found; run "npx cap add android" first`);
  const before = readFileSync(path, 'utf8');
  const after = fn(before);
  console.log(`${after !== before ? 'updated' : 'unchanged'} ${path}`);
  if (after !== before) writeFileSync(path, after);
}

function replaceOnce(src, from, to, what) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`cannot apply "${what}": template text not found`);
  return src.replace(from, to);
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

edit('android/app/build.gradle', (src) => {
  let out = src;
  out = replaceOnce(
    out,
    "apply plugin: 'com.android.application'\n",
    `apply plugin: 'com.android.application'

// Fletchy: identity comes from app.config.json (single source of truth).
// CI overrides the version with ANDROID_VERSION_CODE / ANDROID_VERSION_NAME.
def appConfig = new groovy.json.JsonSlurper().parse(file('../../app.config.json'))
def keystorePath = System.getenv('ANDROID_KEYSTORE_PATH')
`,
    'app config header',
  );
  out = out.replace(/applicationId "[^"]*"/, 'applicationId appConfig.appId');
  out = replaceOnce(out, 'versionCode 1\n', "versionCode((System.getenv('ANDROID_VERSION_CODE') ?: '1').toInteger())\n", 'versionCode');
  out = replaceOnce(out, 'versionName "1.0"\n', "versionName(System.getenv('ANDROID_VERSION_NAME') ?: appConfig.version)\n", 'versionName');
  out = replaceOnce(
    out,
    '    buildTypes {\n',
    `    signingConfigs {
        release {
            // Only the release workflow sets these; the keystore never lives in the repo.
            if (keystorePath) {
                storeFile file(keystorePath)
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
`,
    'signing config',
  );
  out = replaceOnce(
    out,
    `            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'`,
    `            minifyEnabled true
            shrinkResources true
            debuggable false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            if (keystorePath) signingConfig signingConfigs.release`,
    'release build type',
  );
  return out;
});

edit('android/app/src/main/AndroidManifest.xml', (src) => {
  let out = src;
  // Portrait lock on the main activity.
  if (!out.includes('android:screenOrientation=')) {
    out = out.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
  }
  // v1 needs no permissions: the game is served from the APK and makes no network calls.
  // tools:node="remove" also strips it if a library manifest tries to merge it back in.
  if (!out.includes('xmlns:tools=')) {
    out = out.replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android"', '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools"');
  }
  out = out.replace(
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />',
  );
  return out;
});
