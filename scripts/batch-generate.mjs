#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(__dirname, '..');
const TRACKER_PATH = path.join(packRoot, 'generation_tracker.json');
const PROMPT_TEMPLATE_PATH = path.join(packRoot, 'config', 'icon-prompt.md');
const BRAND_LOCKS_PATH = path.join(packRoot, 'config', 'brand-locks.json');
const RAW_DIR = path.join(packRoot, 'assets', 'icons-raw');
const REF_DIR = path.join(packRoot, 'assets', 'icon-generation-references');
const SCRATCH_DIR = path.join(packRoot, 'scratch');
const SKIPPED_FILE = path.join(SCRATCH_DIR, 'skipped-icons.txt');

[RAW_DIR, REF_DIR, SCRATCH_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Dynamic import of google-play-scraper
let gplayScraper = null;
try {
  const gplayMod = await import('google-play-scraper');
  gplayScraper = gplayMod.default || gplayMod;
} catch (e) {}

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
    return args[idx + 1];
  }
  return fallback;
};

// Find mflux edit binary
const candidateMfluxPaths = [
  process.env.MFLUX_COMMAND,
  path.join(packRoot, '.mflux-venv', 'bin', 'mflux-generate-flux2-edit'),
  path.resolve(packRoot, '..', 'Fluff', '.mflux-venv', 'bin', 'mflux-generate-flux2-edit'),
].filter(Boolean);
const mfluxCmd = candidateMfluxPaths.find((candidate) => fs.existsSync(candidate));

if (!mfluxCmd) {
  throw new Error(
    `MFLUX executable not found. Checked: ${candidateMfluxPaths.join(', ')}. ` +
      'Set MFLUX_COMMAND to the full mflux-generate-flux2-edit path.',
  );
}

const defaultModelPath = path.join(os.homedir(), 'AI', 'flux-klein', 'flux2-klein-4b-mlx');
const modelPath = process.env.FLUX_MODEL_PATH || getArg('--model', defaultModelPath);
const steps = getArg('--steps', '4');
const width = getArg('--width', '512');
const height = getArg('--height', '512');
const guidance = getArg('--guidance', '3.5');

let limit = parseInt(getArg('--limit', getArg('-l', getArg('--count', getArg('-n', '1')))), 10);
const targetSlug = getArg('--slug', getArg('-s', getArg('--slugs', null)));
const overwrite = args.includes('--overwrite');
const dryRun = args.includes('--dry-run');
const printOnly = args.includes('--print');

if (!fs.existsSync(TRACKER_PATH)) {
  console.log('🔄 Initializing generation tracker...');
  execSync('node scripts/init-tracker.mjs', { cwd: packRoot, stdio: 'inherit' });
}

const trackerData = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
const allApps = trackerData.apps || [];

// Save tracker helper function
function persistTracker() {
  const stats = trackerData.stats || {};
  stats.completed = allApps.filter((a) => a.status === 'completed').length;
  stats.raw_generated = allApps.filter((a) => a.status === 'raw_generated').length;
  stats.pending = allApps.filter((a) => a.status === 'pending').length;
  trackerData.stats = stats;
  trackerData.updatedAt = new Date().toISOString();
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(trackerData, null, 2), 'utf8');
}

// Load prompt template
let promptTemplate = '';
if (fs.existsSync(PROMPT_TEMPLATE_PATH)) {
  const content = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf8');
  const markerIdx = content.search(/^---\s*$/m);
  if (markerIdx !== -1) {
    const afterMarker = content.slice(markerIdx);
    const newlineIdx = afterMarker.indexOf('\n');
    promptTemplate = (newlineIdx !== -1 ? afterMarker.slice(newlineIdx + 1) : afterMarker).trim();
  } else {
    promptTemplate = content.trim();
  }
} else {
  promptTemplate = `Convert the attached image into a glossy, vibrant 3D app icon. Render the exact subject and exact colors from the attached image into a smooth 3D enamel and glossy finish with polished rounded bevels and clean specular shine. Strictly retain all original colors and shapes from the reference image without desaturating, recoloring, or altering any hue. Solid flat pure white background (#FFFFFF). Clean centered composition, no text, no glow.`;
}

// Load brand locks
let brandLocks = {};
if (fs.existsSync(BRAND_LOCKS_PATH)) {
  try {
    brandLocks = JSON.parse(fs.readFileSync(BRAND_LOCKS_PATH, 'utf8'));
  } catch (e) {}
}

async function getReferenceImage(app, slug, packageId) {
  // 1. Check local & cross-pack caches
  const localCandidates = [
    path.join(REF_DIR, `${packageId || slug}.png`),
    path.join(REF_DIR, `${slug}.png`),
    path.join(REF_DIR, `${slug}.webp`),
    path.join(packRoot, 'assets', 'logo-refs', `${slug}.png`),
    path.resolve(packRoot, '..', 'spidey', 'assets', 'icon-generation-references', `${slug}.png`),
    path.resolve(packRoot, '..', 'spidey', 'assets', 'icon-generation-references', `${packageId || slug}.png`),
    path.resolve(packRoot, '..', 'Fluff', 'assets', 'icon-generation-references', `${slug}.png`),
    path.resolve(packRoot, '..', 'Fluff', 'assets', 'icon-generation-references', `${packageId || slug}.png`),
    path.resolve(packRoot, '..', 'pixel', 'assets', 'icon-generation-references', `${slug}.png`),
    path.resolve(packRoot, '..', '3d-icon-pack', 'assets', 'icon-generation-references', `${slug}.png`),
  ];
  for (const p of localCandidates) {
    if (fs.existsSync(p)) return p;
  }

  const savedPath = path.join(REF_DIR, `${slug}.png`);
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 2. Try google-play-scraper
  if (gplayScraper) {
    if (packageId) {
      try {
        const appInfo = await gplayScraper.app({ appId: packageId });
        if (appInfo && appInfo.icon) {
          const imgRes = await fetch(appInfo.icon.split('=')[0] + '=s512');
          if (imgRes.ok) {
            fs.writeFileSync(savedPath, Buffer.from(await imgRes.arrayBuffer()));
            return savedPath;
          }
        }
      } catch (e) {}
    }
    try {
      const searchRes = await gplayScraper.search({ term: app.name, num: 1, country: 'us' });
      if (searchRes && searchRes[0] && searchRes[0].icon) {
        const imgRes = await fetch(searchRes[0].icon.split('=')[0] + '=s512');
        if (imgRes.ok) {
          fs.writeFileSync(savedPath, Buffer.from(await imgRes.arrayBuffer()));
          return savedPath;
        }
      }
    } catch (e) {}
  }

  // 3. Try Apple App Store search
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(app.name)}&country=us&entity=software&limit=1`;
    const itunesRes = await fetch(itunesUrl);
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const hit = itunesData?.results?.[0];
      if (hit) {
        const artUrl = hit.artworkUrl512 || hit.artworkUrl100;
        if (artUrl) {
          const highResUrl = artUrl.replace(/\/\d+x\d+bb\.(png|jpg|jpeg)$/i, '/512x512bb.$1');
          const imgRes = await fetch(highResUrl);
          if (imgRes.ok) {
            fs.writeFileSync(savedPath, Buffer.from(await imgRes.arrayBuffer()));
            return savedPath;
          }
        }
      }
    }
  } catch (e) {}

  // 4. Try direct Google Play Store web scrape
  if (packageId) {
    try {
      const detailsUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en&gl=us`;
      const res = await fetch(detailsUrl, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        const html = await res.text();
        const match =
          html.match(/property="og:image"\s+content="([^"]+)"/i) ||
          html.match(/name="twitter:image"\s+content="([^"]+)"/i);
        if (match && match[1]) {
          const imgUrl = match[1].replace(/&amp;/g, '&');
          const imgRes = await fetch(imgUrl);
          if (imgRes.ok) {
            fs.writeFileSync(savedPath, Buffer.from(await imgRes.arrayBuffer()));
            return savedPath;
          }
        }
      }
    } catch (e) {}
  }

  return null;
}

// Select items
let selected = [];
if (targetSlug) {
  const targetList = targetSlug.split(',').map((s) => s.trim().toLowerCase());
  for (const slug of targetList) {
    const hit = allApps.find((a) => a.slug === slug || a.canonicalSlug === slug);
    if (hit) selected.push(hit);
    else console.warn(`⚠️ App slug "${slug}" not found in tracker.`);
  }
  if (selected.length === 0) {
    console.error(`❌ None of the requested slugs were found.`);
    process.exit(1);
  }
} else {
  const pendingApps = allApps.filter((a) => {
    if (a.status !== 'pending') return false;
    const rawFile = path.join(RAW_DIR, `${a.slug}.webp`);
    if (!overwrite && fs.existsSync(rawFile)) {
      a.status = 'raw_generated';
      return false;
    }
    return true;
  });
  selected = pendingApps.slice(0, limit);
}

if (selected.length === 0) {
  console.log('🎉 All top icons in the tracker are already generated/completed!');
  process.exit(0);
}

console.log('\n======================================================');
console.log(`📱 DISCO LOCAL MLX GENERATOR (${selected.length} ICON)`);
console.log('======================================================');
console.log(`Model:  ${modelPath}`);
console.log(`Engine: ${mfluxCmd}`);
console.log(`Target: #${selected[0].rank} (${selected[0].slug}) — ${selected[0].name}\n`);

let generatedCount = 0;

for (let i = 0; i < selected.length; i++) {
  const app = selected[i];
  const appName = app.name;
  const slug = app.slug;
  const outPath = path.join(RAW_DIR, `${slug}.webp`);

  const packageId = app.packageId || null;

  console.log(`------------------------------------------------------`);
  console.log(`[${i + 1}/${selected.length}] Generating: #${app.rank} ${appName} (${slug})`);

  // 1. Fetch reference logo
  const refImage = await getReferenceImage(app, slug, packageId);
  if (!refImage) {
    console.warn(`⚠️ No reference logo found for ${appName}. Skipping.`);
    fs.appendFileSync(SKIPPED_FILE, `Missing reference: ${appName} (${slug})\n`);
    continue;
  }
  console.log(`   📸 Reference Image: ${refImage}`);

  // 2. Build prompt
  const lock = brandLocks[slug] ? `Brand Lock: ${brandLocks[slug]}` : '';
  const appPrompt = promptTemplate
    .replace(/\{\{\s*appName\s*\}\}/g, appName)
    .replace(/\{\{\s*brandLock\s*\}\}/g, lock);

  const promptFile = path.join(SCRATCH_DIR, `prompt-${slug}.txt`);
  fs.writeFileSync(promptFile, appPrompt, 'utf8');

  // 3. Command setup
  const seed = Math.floor(Math.random() * 1000000000);
  const cmd = `"${mfluxCmd}" --model "${modelPath}" --image-paths "${refImage}" --prompt-file "${promptFile}" --steps ${steps} --width ${width} --height ${height} --guidance ${guidance} --seed ${seed} --output "${outPath}"`;

  if (printOnly || dryRun) {
    console.log(`   Command: ${cmd}\n`);
    continue;
  }

  try {
    console.log(`   ⏳ Running local MLX model on Apple Silicon...`);
    execSync(cmd, { stdio: 'inherit', timeout: 300000 });

    const mfluxSuffixPath = path.join(RAW_DIR, `${slug}_1.webp`);
    if (fs.existsSync(mfluxSuffixPath)) {
      fs.renameSync(mfluxSuffixPath, outPath);
    }

    if (fs.existsSync(outPath)) {
      app.status = 'raw_generated';
      app.updatedAt = new Date().toISOString();
      generatedCount++;
      console.log(`✅ [Success] Generated: assets/icons-raw/${slug}.webp`);
      persistTracker();
    }
  } catch (err) {
    console.error(`❌ Failed generating ${slug}: ${err.message}`);
  }
}

if (!dryRun && !printOnly) {
  persistTracker();
  console.log('\n======================================================');
  console.log(`✅ Generation finished! Saved in assets/icons-raw/`);
  console.log('======================================================\n');
}
