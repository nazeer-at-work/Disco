#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(__dirname, '..');
const TRACKER_PATH = path.join(packRoot, 'generation_tracker.json');

const searchMasters = [
  path.join(packRoot, '../.agents/master-catalog/arcticons_master_3000.json'),
  path.join(packRoot, '../icon-pack/master_data/arcticons_master_3000.json'),
  '/Users/nazeer/Desktop/Icon Packs/.agents/master-catalog/arcticons_master_3000.json',
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons_master_3000.json',
];

const masterPath = searchMasters.find((p) => fs.existsSync(p));
if (!masterPath) {
  console.error('❌ Could not find arcticons_master_3000.json dataset.');
  process.exit(1);
}

console.log(`🔄 Indexing Disco Generation Tracker from: ${masterPath}`);
const rawMaster = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const masterApps = Array.isArray(rawMaster) ? rawMaster : (rawMaster.apps || []);

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const normUnder = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Known variant/duplicate consolidations to map to canonical icons
const CONSOLIDATIONS = {
  duolingo_streaksaver_1: 'duolingo',
  duolingo_streaksaver_2: 'duolingo',
  duolingo_streaksaver_3: 'duolingo',
  duolingo_streaksaver_4: 'duolingo',
  duolingo_streaksaver_5: 'duolingo',
  duolingo_streaksaver_6: 'duolingo',
  duolingo_streaksaver_7: 'duolingo',
  duolingo_streaksaver_8: 'duolingo',
  duolingo_steaksaver_2: 'duolingo',
  duolingo_freeze_1: 'duolingo',
  duolingo_freeze_2: 'duolingo',
  duolingo_streak: 'duolingo',
  duolingo_sick: 'duolingo',
  telegram_alt_1: 'telegram',
  telegram_alt_2: 'telegram',
  ayugram: 'telegram',
  exteragram: 'telegram',
  exteragram_orbit: 'telegram',
  signal_alt_1: 'signal',
  signal_alt_2: 'signal',
  waves_2: 'signal',
  niagara_launcher_pro: 'niagara_launcher',
  niagara_launcher_recently_installed: 'niagara_launcher',
  niagara_launcher_settings: 'niagara_launcher',
  firefox_momo: 'firefox',
  google_settings: 'google',
  microgsettings: 'google',
  unifiednlp: 'google',
  google_movies: 'google_tv',
  google_music: 'youtube_music',
};

// 1. Shipped drawables in Disco
const shippedDrawables = new Set();
const resDrawableDir = path.join(packRoot, 'android/app/src/main/res/drawable-nodpi');
if (fs.existsSync(resDrawableDir)) {
  fs.readdirSync(resDrawableDir).forEach((f) => {
    if (f.endsWith('.webp')) {
      const base = f.replace(/\.webp$/, '').replace(/^ic_disco_/, '');
      shippedDrawables.add(base);
    }
  });
}

// 2. Mapped packages from config/icon-pack.json
const iconPackJsonPath = path.join(packRoot, 'config', 'icon-pack.json');
const coveredPackages = new Set();
const mappedDrawables = new Set();

if (fs.existsSync(iconPackJsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(iconPackJsonPath, 'utf8'));
    (data.mappings || []).forEach((m) => {
      if (m.drawable && shippedDrawables.has(m.drawable)) {
        mappedDrawables.add(m.drawable);
        if (m.component) {
          const clean = m.component.replace(/^ComponentInfo\{/, '').replace(/\}$/, '');
          const pkg = clean.split('/')[0].toLowerCase();
          if (pkg) coveredPackages.add(pkg);
        }
      }
    });
    Object.keys(data.drawables || {}).forEach((d) => {
      const base = d.replace(/^ic_disco_/, '');
      if (shippedDrawables.has(base)) mappedDrawables.add(base);
    });
  } catch (e) {}
}

// Check raw icons in assets/icons-raw
const rawDir = path.join(packRoot, 'assets/icons-raw');
const rawSlugs = new Set();
if (fs.existsSync(rawDir)) {
  fs.readdirSync(rawDir).forEach((f) => {
    if (/\.(png|webp)$/i.test(f)) {
      rawSlugs.add(norm(f.replace(/\.(png|webp)$/i, '')));
      rawSlugs.add(normUnder(f.replace(/\.(png|webp)$/i, '')));
    }
  });
}

// Load existing tracker if present to preserve timestamps
let existingState = new Map();
if (fs.existsSync(TRACKER_PATH)) {
  try {
    const cur = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
    (cur.apps || []).forEach((a) => {
      existingState.set(a.slug, a);
    });
  } catch (e) {}
}

const trackerApps = [];
let completedCount = 0;
let rawCount = 0;
let pendingCount = 0;

const seenPendingCanonical = new Set();
const seenPendingPackages = new Set();

masterApps.forEach((app, idx) => {
  const slug = app.slug;
  const canonicalSlug = CONSOLIDATIONS[slug] || slug;
  const nSlug = norm(slug);
  const nSlugUnder = normUnder(slug);
  const nCanSlug = norm(canonicalSlug);
  const nCanSlugUnder = normUnder(canonicalSlug);

  // Check if app is already covered in Disco
  let isCovered =
    shippedDrawables.has(slug) ||
    shippedDrawables.has(`_${slug}`) ||
    shippedDrawables.has(canonicalSlug) ||
    shippedDrawables.has(`_${canonicalSlug}`) ||
    mappedDrawables.has(slug) ||
    mappedDrawables.has(canonicalSlug);

  // Check if any component shares an already-covered package
  if (!isCovered && Array.isArray(app.components)) {
    for (const c of app.components) {
      const clean = c.replace(/^ComponentInfo\{/, '').replace(/\}$/, '');
      const pkg = clean.split('/')[0].toLowerCase();
      if (coveredPackages.has(pkg)) {
        isCovered = true;
        break;
      }
    }
  }

  // Check if raw generated
  let isRaw = !isCovered && (rawSlugs.has(nSlug) || rawSlugs.has(nSlugUnder) || rawSlugs.has(nCanSlug) || rawSlugs.has(nCanSlugUnder));

  let status = 'pending';
  if (isCovered) {
    status = 'completed';
    completedCount++;
  } else if (isRaw) {
    status = 'raw_generated';
    rawCount++;
  } else {
    // Check if this is a duplicate variant of an already pending app
    let firstPkg = null;
    if (Array.isArray(app.components)) {
      for (const c of app.components) {
        const clean = c.replace(/^ComponentInfo\{/, '').replace(/\}$/, '');
        firstPkg = clean.split('/')[0].toLowerCase();
        break;
      }
    }

    if (seenPendingCanonical.has(canonicalSlug) || (firstPkg && seenPendingPackages.has(firstPkg))) {
      // Mark as completed/collapsed so it does NOT generate duplicate icons
      status = 'completed';
      completedCount++;
    } else {
      if (firstPkg) seenPendingPackages.add(firstPkg);
      seenPendingCanonical.add(canonicalSlug);
      pendingCount++;
    }
  }

  const prev = existingState.get(slug) || {};

  trackerApps.push({
    rank: app.rank || idx + 1,
    slug: app.slug,
    canonicalSlug: canonicalSlug,
    name: app.name,
    category: app.category || 'Other',
    downloads: app.downloads || 0,
    packageId: app.packageId || '',
    status: status,
    generatedAt: status === 'completed' ? prev.generatedAt || new Date().toISOString() : null,
  });
});

const out = {
  updatedAt: new Date().toISOString(),
  totalMasterApps: masterApps.length,
  stats: {
    completed: completedCount,
    raw_generated: rawCount,
    pending: pendingCount,
    completionPercentage: `${((completedCount / masterApps.length) * 100).toFixed(1)}%`,
  },
  apps: trackerApps,
};

fs.writeFileSync(TRACKER_PATH, JSON.stringify(out, null, 2), 'utf8');

console.log('\n======================================================');
console.log(`✅ DISCO TRACKER INITIALIZED (NO DUPLICATES): ${TRACKER_PATH}`);
console.log(`   Total Apps:     ${masterApps.length}`);
console.log(`   Completed:      ${completedCount} (${out.stats.completionPercentage})`);
console.log(`   Raw Generated:  ${rawCount}`);
console.log(`   Pending:        ${pendingCount}`);
console.log('======================================================\n');
