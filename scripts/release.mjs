#!/usr/bin/env node
/**
 * One-command rebrand + release. Reads config/pack.config.json and:
 *   - optionally bumps the version (--patch | --minor | --major | --version x.y.z),
 *     incrementing versionCode each bump,
 *   - syncs identity into every file that carries it (build.gradle, strings.xml,
 *     app.json displayName, package.json version, .env),
 *   - optionally builds the AAB / APK and installs.
 *
 * Usage:
 *   node scripts/release.mjs                 # sync config from pack.config.json only
 *   node scripts/release.mjs --patch         # bump 1.0.0 -> 1.0.1 (+versionCode), sync
 *   node scripts/release.mjs --version 2.1.0 # set exact version, sync
 *   node scripts/release.mjs --minor --aab --install
 *
 * Signing for release builds is read by Gradle from android/gradle.properties
 * (git-ignored): DISCO_UPLOAD_STORE_FILE / DISCO_UPLOAD_KEY_ALIAS / *_PASSWORD.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(root, 'config', 'pack.config.json');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? (process.argv[i + 1] ?? true) : undefined;
}
const has = name => process.argv.includes(name);

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}
function writeFile(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}
function replaceInFile(rel, pairs) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.warn(`[release] skip (missing): ${rel}`);
    return;
  }
  let text = readFile(p);
  for (const [re, replacement] of pairs) {
    if (!re.test(text)) {
      console.warn(`[release] pattern not found in ${rel}: ${re}`);
      continue;
    }
    text = text.replace(re, replacement);
  }
  writeFile(p, text);
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split('.').map(n => parseInt(n, 10) || 0);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function main() {
  const cfg = JSON.parse(readFile(cfgPath));

  // Resolve target version.
  const explicit = arg('--version');
  let versionName = cfg.versionName;
  let versionCode = Number(cfg.versionCode) || 1;
  let bumped = false;
  if (typeof explicit === 'string') {
    versionName = explicit;
    versionCode += 1;
    bumped = true;
  } else if (has('--major') || has('--minor') || has('--patch')) {
    const kind = has('--major') ? 'major' : has('--minor') ? 'minor' : 'patch';
    versionName = bumpVersion(versionName, kind);
    versionCode += 1;
    bumped = true;
  }

  if (bumped) {
    cfg.versionName = versionName;
    cfg.versionCode = versionCode;
    writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  }

  const { appName, applicationId, namespace, playStoreBaseUrl } = cfg;
  console.log(`[release] ${appName} (${applicationId}) v${versionName} (code ${versionCode})`);

  // android/app/build.gradle
  replaceInFile('android/app/build.gradle', [
    [/namespace\s+"[^"]*"/, `namespace "${namespace}"`],
    [/applicationId\s+"[^"]*"/, `applicationId "${applicationId}"`],
    [/versionCode\s+\d+/, `versionCode ${versionCode}`],
    [/versionName\s+"[^"]*"/, `versionName "${versionName}"`],
  ]);

  // strings.xml — launcher label
  replaceInFile('android/app/src/main/res/values/strings.xml', [
    [/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${appName}</string>`],
  ]);

  // app.json — displayName only (name is the stable RN component id)
  replaceInFile('app.json', [[/"displayName":\s*"[^"]*"/, `"displayName": "${appName}"`]]);

  // package.json — version
  replaceInFile('package.json', [[/"version":\s*"[^"]*"/, `"version": "${versionName}"`]]);

  // .env — consumed by src/config/app-links.ts at build time
  const env = [
    `APP_NAME=${appName}`,
    `APP_PACKAGE_NAME=${applicationId}`,
    `PLAY_STORE_BASE_URL=${playStoreBaseUrl}`,
    '',
  ].join('\n');
  writeFile(path.join(root, '.env'), env);

  console.log('[release] config synced.');

  // Builds
  const gradleHome = process.env.GRADLE_USER_HOME || path.join(root, '.gradle-local');
  const runGradle = task => {
    console.log(`[release] gradle ${task}...`);
    const r = spawnSync('./gradlew', [task], {
      cwd: path.join(root, 'android'),
      stdio: 'inherit',
      env: { ...process.env, GRADLE_USER_HOME: gradleHome },
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };

  if (has('--aab')) {
    runGradle('bundleRelease');
    const out = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
    if (fs.existsSync(out)) {
      const dest = path.join(root, `${applicationId}-${versionName}.aab`);
      fs.copyFileSync(out, dest);
      console.log(`[release] AAB -> ${path.relative(root, dest)}`);
    }
  }
  if (has('--apk')) {
    runGradle('assembleRelease');
    const apk = path.join(root, 'android/app/build/outputs/apk/release/app-arm64-v8a-release.apk');
    if (fs.existsSync(apk) && has('--install')) {
      const r = spawnSync('adb', ['install', '-r', apk], { stdio: 'inherit' });
      if (r.status !== 0) console.warn('[release] adb install failed (is a device connected?)');
    }
  }
}

main();
