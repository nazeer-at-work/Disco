#!/usr/bin/env node
/**
 * Rebrand the whole template to a new pack name in one shot. Renames every
 * internal token (drawable prefix ic_<slug>_, Java package, RN icon component,
 * signing-property prefix) AND the user-facing identity (display name,
 * applicationId), then records the new identity in config/pack.config.json so it
 * can be run again later.
 *
 * Usage:
 *   node scripts/setup-pack.mjs --name "Disco"
 *   node scripts/setup-pack.mjs --name "Disco" --id com.mystudio.disco --package com.mystudio.disco
 *   node scripts/setup-pack.mjs --name "Disco" --dry-run
 *
 * Defaults: slug = lowercased name; package = com.<slug>; applicationId = <package>.iconpack.
 * After running: `npm run release` (sync versions/labels) then `npm run build:icon-pack`.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(root, 'config', 'pack.config.json');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', '.gradle', '.gradle-local', '.cache',
  'lawnicons', // config/lawnicons cache (upstream data)
]);
const BINARY_EXT = new Set([
  '.webp', '.png', '.jpg', '.jpeg', '.gif', '.ttf', '.otf', '.keystore',
  '.jks', '.aab', '.apk', '.ico', '.zip', '.jar', '.so',
]);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock']);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const DRY = process.argv.includes('--dry-run');

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
const pascal = s => {
  const c = String(s).replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return c.map(w => w[0].toUpperCase() + w.slice(1)).join('');
};
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lastSeg = pkg => pkg.split('.').pop();

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.git')) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else {
      yield path.join(dir, entry.name);
    }
  }
}

async function main() {
  const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
  const brand = cfg.brand || { name: cfg.appName, slug: slugify(cfg.appName), componentName: 'DiscoIcon', signingPrefix: 'FLUFFY' };

  const newName = arg('--name');
  if (!newName) {
    console.error('Usage: node scripts/setup-pack.mjs --name "YourPackName" [--id com.x.y] [--package com.x.y] [--dry-run]');
    process.exit(1);
  }
  const newSlug = slugify(newName);
  const newPkg = arg('--package', `com.${newSlug}`);
  const newAppId = arg('--id', `${newPkg}.iconpack`);

  const cur = {
    name: brand.name,
    slug: brand.slug,
    component: brand.componentName,
    signing: brand.signingPrefix,
    pkg: cfg.namespace,
    appId: cfg.applicationId,
  };
  const next = {
    name: newName,
    slug: newSlug,
    component: `${pascal(newName)}Icon`,
    signing: newSlug.toUpperCase(),
    pkg: newPkg,
    appId: newAppId,
  };

  // Ordered, specific -> general so longer tokens replace before their substrings.
  const pairs = [
    [`ic_${cur.slug}_`, `ic_${next.slug}_`],
    [cur.component, next.component],
    [cur.appId, next.appId],
    [cur.pkg.replace(/\./g, '/'), next.pkg.replace(/\./g, '/')],
    [cur.pkg.replace(/\./g, '_'), next.pkg.replace(/\./g, '_')],
    [cur.pkg, next.pkg],
    [`${cur.signing}_`, `${next.signing}_`],
    [cur.name, next.name],
    [cap(lastSeg(cur.pkg)), cap(lastSeg(next.pkg))], // e.g. "Disco" -> "Disco"
    [cur.slug, next.slug],
    [lastSeg(cur.pkg), lastSeg(next.pkg)],           // e.g. "disco" -> "disco"
  ].filter(([a, b]) => a && b && a !== b);

  const applyPairs = text => {
    let out = text;
    for (const [a, b] of pairs) out = out.split(a).join(b);
    return out;
  };

  console.log(`Rebrand: "${cur.name}" -> "${next.name}"`);
  console.log(`  package:  ${cur.pkg} -> ${next.pkg}`);
  console.log(`  appId:    ${cur.appId} -> ${next.appId}`);
  console.log(`  prefix:   ic_${cur.slug}_ -> ic_${next.slug}_`);
  console.log(`  component:${cur.component} -> ${next.component}`);
  if (DRY) console.log('\n(dry run — no files changed)\n');

  // 1) Replace file contents.
  let contentChanges = 0;
  for (const file of walk(root)) {
    const base = path.basename(file);
    if (SKIP_FILES.has(base) || BINARY_EXT.has(path.extname(file).toLowerCase())) continue;
    const text = await fsp.readFile(file, 'utf8').catch(() => null);
    if (text == null) continue;
    const updated = applyPairs(text);
    if (updated !== text) {
      contentChanges += 1;
      if (!DRY) await fsp.writeFile(file, updated, 'utf8');
    }
  }

  // 2) Rename files whose names carry a token.
  let fileRenames = 0;
  for (const file of [...walk(root)]) {
    const dir = path.dirname(file);
    const base = path.basename(file);
    const renamed = applyPairs(base);
    if (renamed !== base) {
      fileRenames += 1;
      if (!DRY) await fsp.rename(file, path.join(dir, renamed));
    }
  }

  // 3) Move the Java package directory.
  const javaRoot = path.join(root, 'android', 'app', 'src', 'main', 'java');
  const oldDir = path.join(javaRoot, ...cur.pkg.split('.'));
  const newDir = path.join(javaRoot, ...next.pkg.split('.'));
  let dirMoved = false;
  if (fs.existsSync(oldDir) && oldDir !== newDir) {
    dirMoved = true;
    if (!DRY) {
      await fsp.mkdir(path.dirname(newDir), { recursive: true });
      await fsp.rename(oldDir, newDir);
      // prune now-empty old parent (e.g. com/ if it only held the old leaf)
      const oldParent = path.dirname(oldDir);
      if (fs.existsSync(oldParent) && fs.readdirSync(oldParent).length === 0) {
        await fsp.rmdir(oldParent);
      }
    }
  }

  // 4) Persist the new identity.
  if (!DRY) {
    cfg.appName = next.name;
    cfg.applicationId = next.appId;
    cfg.namespace = next.pkg;
    cfg.brand = { name: next.name, slug: next.slug, componentName: next.component, signingPrefix: next.signing };
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  }

  // 5) Residual check.
  let residual = 0;
  const tokens = [cur.slug, cur.component, lastSeg(cur.pkg), cur.signing].filter(Boolean);
  const re = new RegExp(tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  for (const file of walk(root)) {
    if (BINARY_EXT.has(path.extname(file).toLowerCase()) || SKIP_FILES.has(path.basename(file))) continue;
    const text = await fsp.readFile(file, 'utf8').catch(() => null);
    if (text && re.test(text)) {
      residual += 1;
      if (process.argv.includes('--verbose')) console.log(`  residual: ${path.relative(root, file)}`);
    }
  }

  console.log(`\n${DRY ? '[dry-run] would change' : 'changed'}: ${contentChanges} files, ${fileRenames} renamed, java dir ${dirMoved ? 'moved' : 'unchanged'}.`);
  if (residual) console.log(`⚠ ${residual} file(s) still contain an old token (run with --verbose to list). Often fine (e.g. comments); review if unexpected.`);
  if (!DRY) console.log('Next: npm run release   then   npm run build:icon-pack && npm run build:appfilter');
}

main().catch(err => { console.error(err); process.exit(1); });
