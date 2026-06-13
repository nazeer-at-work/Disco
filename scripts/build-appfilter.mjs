#!/usr/bin/env node
/**
 * Build android/app/src/main/assets/appfilter.xml (the component -> icon mapping
 * the launcher reads) from three sources, unioned per drawable:
 *
 *   1. Lawnicons' community appfilter (pinned, Apache-2.0) — broad, well-maintained
 *      coverage of component/activity names. Matched to our icons by drawable slug,
 *      app-name slug, or an explicit alias.
 *   2. The existing committed appfilter — preserves any hand-curated mappings
 *      (e.g. regional apps Lawnicons doesn't cover) for drawables we still ship.
 *   3. config/aliases.json — manual ourSlug -> lawniconsKey overrides.
 *
 * We never ship Lawnicons' icons — only the mapping data. See THIRD_PARTY_NOTICES.md.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAWNICONS_REF = 'v2.17.1';
const lawniconsCache = path.join(root, 'config', 'lawnicons', 'appfilter.xml');
const lawniconsUrl = `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/${LAWNICONS_REF}/app/assets/appfilter.xml`;
const aliasesPath = path.join(root, 'config', 'aliases.json');
const drawableDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
// The manifest references @xml/appfilter, so res/xml is authoritative; we also
// write assets/ since some launchers look there. Both must stay in sync.
const outputPaths = [
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'appfilter.xml'),
  path.join(root, 'android', 'app', 'src', 'main', 'assets', 'appfilter.xml'),
];

const NON_ICON = new Set(['ic_fluffy_back', 'ic_fluffy_mask', 'ic_fluffy_upon']);

// Canonical slug used to match names across sources.
function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Pull component / drawable / name out of each <item .../> line.
function parseAppfilterItems(xml) {
  const items = [];
  const re = /<item\b[^>]*\/?>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const tag = m[0];
    const component = (tag.match(/component="([^"]+)"/) || [])[1];
    if (!component) continue;
    const drawable = (tag.match(/drawable="([^"]+)"/) || [])[1] || '';
    const name = (tag.match(/name="([^"]+)"/) || [])[1] || '';
    items.push({ component, drawable, name });
  }
  return items;
}

async function ensureLawnicons() {
  if (fs.existsSync(lawniconsCache)) {
    return fsp.readFile(lawniconsCache, 'utf8');
  }
  console.log(`[appfilter] Fetching Lawnicons ${LAWNICONS_REF} appfilter...`);
  const res = await fetch(lawniconsUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Lawnicons appfilter (${res.status}). URL: ${lawniconsUrl}`);
  }
  const xml = await res.text();
  await fsp.mkdir(path.dirname(lawniconsCache), { recursive: true });
  await fsp.writeFile(lawniconsCache, xml, 'utf8');
  return xml;
}

async function main() {
  // Our shipped drawables -> map of slug -> resource name.
  const ourDrawables = fs
    .readdirSync(drawableDir)
    .filter(f => /^ic_fluffy_.+\.webp$/i.test(f))
    .map(f => path.basename(f, path.extname(f)))
    .filter(name => !NON_ICON.has(name) && !/^ic_fluffy_symbol_/.test(name));
  const ourBySlug = new Map(); // slug -> ic_fluffy_<...>
  ourDrawables.forEach(drawable => {
    ourBySlug.set(norm(drawable.replace(/^ic_fluffy_/, '')), drawable);
  });

  // Lawnicons index: matchSlug -> Set(component)
  const lawnXml = await ensureLawnicons();
  const lawnIndex = new Map();
  const addToIndex = (slug, component) => {
    if (!slug) return;
    if (!lawnIndex.has(slug)) lawnIndex.set(slug, new Set());
    lawnIndex.get(slug).add(component);
  };
  for (const item of parseAppfilterItems(lawnXml)) {
    addToIndex(norm(item.drawable), item.component);
    addToIndex(norm(item.name), item.component);
  }

  // Preserve existing curated mappings for drawables we still ship.
  const preservedByDrawable = new Map(); // ic_<prefix>_<...> -> Set(component)
  const existingPath = outputPaths.find(p => fs.existsSync(p));
  if (existingPath) {
    for (const item of parseAppfilterItems(await fsp.readFile(existingPath, 'utf8'))) {
      if (!ourBySlug.has(norm(item.drawable.replace(/^ic_[a-z0-9]+_/, '')))) continue;
      if (!preservedByDrawable.has(item.drawable)) preservedByDrawable.set(item.drawable, new Set());
      preservedByDrawable.get(item.drawable).add(item.component);
    }
  }

  const aliases = fs.existsSync(aliasesPath)
    ? JSON.parse(await fsp.readFile(aliasesPath, 'utf8'))
    : {};

  // Build the final mapping, deduping components globally (first drawable wins).
  const usedComponents = new Set();
  const rows = []; // { component, drawable }
  const mappedDrawables = new Set();
  const sortedSlugs = [...ourBySlug.keys()].sort();

  for (const slug of sortedSlugs) {
    const drawable = ourBySlug.get(slug);
    const components = new Set(preservedByDrawable.get(drawable) || []);

    const aliasVal = aliases[slug] ?? aliases[drawable.replace(/^ic_fluffy_/, '')];
    const candidateKeys = [slug];
    if (Array.isArray(aliasVal)) candidateKeys.push(...aliasVal.map(norm));
    else if (aliasVal) candidateKeys.push(norm(aliasVal));

    for (const key of candidateKeys) {
      const hits = lawnIndex.get(key);
      if (hits) hits.forEach(c => components.add(c));
    }

    let count = 0;
    for (const component of [...components].sort()) {
      if (usedComponents.has(component)) continue;
      usedComponents.add(component);
      rows.push({ component, drawable });
      count += 1;
    }
    if (count > 0) mappedDrawables.add(drawable);
  }

  rows.sort((a, b) => a.component.localeCompare(b.component));

  const body = rows
    .map(r => `    <item component="${xmlEscape(r.component)}" drawable="${r.drawable}" />`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`;
  for (const out of outputPaths) {
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, xml, 'utf8');
  }

  const unmapped = [...ourBySlug.values()].filter(d => !mappedDrawables.has(d)).sort();
  console.log(`[appfilter] ${ourBySlug.size} icons | ${mappedDrawables.size} mapped | ${rows.length} component entries (Lawnicons ${LAWNICONS_REF}).`);
  if (unmapped.length) {
    console.log(`[appfilter] ${unmapped.length} icons have NO component mapping yet (add to config/aliases.json or map on-device):`);
    console.log('  ' + unmapped.map(d => d.replace(/^ic_fluffy_/, '')).join(', '));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
