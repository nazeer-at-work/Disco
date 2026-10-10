#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const searchMasters = [
  path.join(root, '../.agents/master-catalog/arcticons_master_3000.json'),
  path.join(root, '../icon-pack/master_data/arcticons_master_3000.json'),
  '/Users/nazeer/Desktop/Icon Packs/.agents/master-catalog/arcticons_master_3000.json',
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons_master_3000.json',
];

const masterPath = searchMasters.find((p) => fs.existsSync(p));
if (!masterPath) {
  console.error('❌ Could not find arcticons_master_3000.json.');
  process.exit(1);
}

const rawMaster = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const masterApps = Array.isArray(rawMaster) ? rawMaster : (rawMaster.apps || []);
const masterBySlug = new Map();
masterApps.forEach((a) => {
  masterBySlug.set(a.slug, a);
});

const srcDir = path.join(root, 'assets', 'icons-src');
const resDrawableDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
const iconPackJsonPath = path.join(root, 'config', 'icon-pack.json');
const iconsJsonPath = path.join(root, 'config', 'icons.json');

const iconPackConfig = JSON.parse(fs.readFileSync(iconPackJsonPath, 'utf8'));
iconPackConfig.drawables = iconPackConfig.drawables || {};
iconPackConfig.mappings = iconPackConfig.mappings || [];

const iconsJson = fs.existsSync(iconsJsonPath)
  ? JSON.parse(fs.readFileSync(iconsJsonPath, 'utf8'))
  : { apps: [] };
const iconsJsonApps = iconsJson.apps || [];
const iconsJsonSlugSet = new Set(iconsJsonApps.map((a) => a.slug));

// Scan all source webps
const sourceFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.webp'));
const sourceSlugs = new Set(sourceFiles.map((f) => path.basename(f, '.webp')));

console.log(`\n🔄 Syncing Disco Icon Pack from ${sourceFiles.length} source icons...`);

// Clean existing mappings to avoid duplicate entries
const existingMappingKeys = new Set();
const dedupedMappings = [];
for (const m of iconPackConfig.mappings) {
  if (sourceSlugs.has(m.drawable)) {
    const key = `${m.component}|${m.drawable}`;
    if (!existingMappingKeys.has(key)) {
      existingMappingKeys.add(key);
      dedupedMappings.push(m);
    }
  }
}
iconPackConfig.mappings = dedupedMappings;

let newIconsCount = 0;
let newMappingsCount = 0;

for (const file of sourceFiles) {
  const slug = path.basename(file, '.webp');

  // Copy to res/drawable-nodpi
  const destRes = path.join(resDrawableDir, `${slug}.webp`);
  if (!fs.existsSync(destRes)) {
    fs.copyFileSync(path.join(srcDir, file), destRes);
  }

  // Ensure entry in drawables map
  if (!iconPackConfig.drawables[slug]) {
    iconPackConfig.drawables[slug] = {
      template: 'raster',
      rasterSource: slug,
      rasterDrawable: slug,
      includeBase: false,
    };
  }

  // Ensure entry in config/icons.json
  if (!iconsJsonSlugSet.has(slug)) {
    const appInfo = masterBySlug.get(slug);
    const name = appInfo ? appInfo.name : slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    iconsJsonApps.push({ name, slug });
    iconsJsonSlugSet.add(slug);
    newIconsCount++;
  }

  // Add component mappings from master catalog if not already mapped
  const appInfo = masterBySlug.get(slug);
  if (appInfo && Array.isArray(appInfo.components)) {
    for (const comp of appInfo.components) {
      const key = `${comp}|${slug}`;
      if (!existingMappingKeys.has(key)) {
        iconPackConfig.mappings.push({ component: comp, drawable: slug });
        existingMappingKeys.add(key);
        newMappingsCount++;
      }
    }
  }
}

// Sort configs
iconsJsonApps.sort((a, b) => a.slug.localeCompare(b.slug));
iconsJson.apps = iconsJsonApps;
iconPackConfig.mappings.sort((a, b) => a.drawable.localeCompare(b.drawable) || a.component.localeCompare(b.component));

fs.writeFileSync(iconPackJsonPath, JSON.stringify(iconPackConfig, null, 2), 'utf8');
fs.writeFileSync(iconsJsonPath, JSON.stringify(iconsJson, null, 2), 'utf8');

console.log(`✅ Updated configs (+${newIconsCount} icons, +${newMappingsCount} mappings).`);
console.log('🔄 Rebuilding launcher appfilter & manifest...');
execSync('npm run build:icon-pack', { cwd: root, stdio: 'inherit' });

console.log('🔄 Updating generation tracker...');
try {
  execSync('node scripts/init-tracker.mjs', { cwd: root, stdio: 'inherit' });
} catch (e) {}

console.log('\n✨ Sync completed successfully!\n');
