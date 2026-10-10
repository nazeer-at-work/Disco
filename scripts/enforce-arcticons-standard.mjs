#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsSrcDir = path.join(root, 'assets', 'icons-src');
const drawableNodpiDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
const configPath = path.join(root, 'config', 'icon-pack.json');
const iconsJsonPath = path.join(root, 'config', 'icons.json');
const logoPath = path.join(root, 'assets', 'logo', 'logo.webp');

const masterJsonPaths = [
  path.join(root, '../.agents/master-catalog/arcticons_master_3000.json'),
  '/Users/nazeer/Desktop/Icon Packs/.agents/master-catalog/arcticons_master_3000.json',
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons_master_3000.json',
];
const masterXmlPaths = [
  path.join(root, '../.agents/master-catalog/arcticons-appfilter.xml'),
  '/Users/nazeer/Desktop/Icon Packs/.agents/master-catalog/arcticons-appfilter.xml',
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons-appfilter.xml',
];

const masterJsonPath = masterJsonPaths.find((p) => fs.existsSync(p));
const masterXmlPath = masterXmlPaths.find((p) => fs.existsSync(p));

if (!masterJsonPath || !masterXmlPath) {
  console.error('❌ Could not find Arcticons master catalog datasets.');
  process.exit(1);
}

// Canonical renames to convert Lawnicons/legacy Disco slugs to exact Arcticons/Fluffy standards
const LEGACY_SLUG_RENAMES = {
  chatgpt: 'openai_chatgpt',
  chrome: 'google_chrome',
  gmail: 'google_mail',
  outlook: 'microsoft_outlook',
  messenger: 'facebook_messenger',
  brave_browser: 'brave',
  dominos_pizza: 'dominos',
  x: 'twitter',
  subway_surfers: 'subwaysurfers',
  cash_app: 'cashapp',
  character_ai: 'characterai',
  capital_one: 'capitalone',
  sleep_cycle: 'sleepcycle',
  vampire_survivors: 'vampiresurvivors',
  kiwi_browser: 'kiwibrowser',
  organic_maps: 'organicmaps',
  phantom_wallet: 'phantom',
  wps_office: 'wpsoffice',
  booking_com: 'booking',
  american_express: 'amex',
  call_of_duty_mobile: 'call_of_duty',
  discovery: 'discovery_',
  aloha_browser: 'aloha',
  amazon_kindle: 'kindle',
  bloons_td_6: 'bloonstd6',
  dream_league_soccer: 'dreamleaguesoccer',
  fifa_soccer: 'ea_sports_fc_mobile',
  filmora: 'filmorago',
  flo_period_tracker: 'flo',
  garena_free_fire: 'free_fire',
  google_arts_culture: 'google_arts_and_culture',
  google_calculator: 'calculator',
  google_clock: 'clock',
  hill_climb_racing_2: 'hill_climb_2',
  home_workout: 'homeworkout',
  honkai_impact_3: 'honkaiimpact3',
  magic_tiles_3: 'magic_tiles',
  microsoft_swiftkey: 'swiftkey',
  microsoft_to_do: 'microsoft_todo',
  mobile_legends: 'mobile_legends_bang_bang',
  monday_com: 'monday',
  mx_player: 'mx',
  notion_calendar: 'cron',
  peacock_tv: 'peacock',
  sleep_as_android: 'sleep',
  standoff_2: 'standoff2',
  the_economist: 'economist',
  the_guardian: 'guardian',
  the_new_york_times: 'nyt',
  yandex_browser: 'yandex',
  h_m: 'hm',
  substack: 'substack_reader',
  candy_crush_soda_saga: 'candy_crush_soda',
  adobe_photoshop_express: 'photoshop_express',
  hotspot_shield: 'hotspotshield',
  spark_mail: 'spark',
  files_by_google: 'google_files',
  gboard: 'google_keyboard',
  uber_eats: 'ubereats',
  crypto_com: 'cryptocom',
  among_us: 'amongus',
  apple_music: 'applemusic',
  best_buy: 'bestbuy',
  brawl_stars: 'brawlstars',
  news_break: 'newsbreak',
  pizza_hut: 'pizzahut',
  tor_browser: 'torbrowser',
  total_commander: 'totalcommander',
  zoho_mail: 'zohomail',
  last_fm: 'lastfm',
  plague_inc: 'plagueinc',
  trip_com: 'tripcom',
};

// Canonical pairs to harmonize between generic names and official Arcticons names
const CORE_CANONICAL_PAIRS = [
  { canonical: 'google_photos', fallback: 'photos' },
  { canonical: 'google_mail', fallback: 'gmail' },
  { canonical: 'google_maps', fallback: 'maps' },
  { canonical: 'google_drive', fallback: 'drive' },
  { canonical: 'google_messages', fallback: 'messages' },
  { canonical: 'google_chrome', fallback: 'chrome' },
  { canonical: 'google_phone', fallback: 'phone' },
  { canonical: 'google_contacts', fallback: 'contacts' },
  { canonical: 'google_camera', fallback: 'camera' },
  { canonical: 'google_play_store', fallback: 'playstore' },
  { canonical: 'google_play_store', fallback: 'play_store' },
  { canonical: 'google_calendar', fallback: 'calendar' },
  { canonical: 'clock', fallback: 'google_clock' },
  { canonical: 'calculator', fallback: 'google_calculator' },
  { canonical: 'google_files', fallback: 'files' },
  { canonical: 'facebook_messenger', fallback: 'messenger' },
  { canonical: 'microsoft_outlook', fallback: 'outlook' },
  { canonical: 'openai_chatgpt', fallback: 'chatgpt' },
  { canonical: 'ubereats', fallback: 'uber_eats' },
  { canonical: 'cryptocom', fallback: 'crypto_com' },
  { canonical: 'amongus', fallback: 'among_us' },
  { canonical: 'applemusic', fallback: 'apple_music' },
  { canonical: 'bestbuy', fallback: 'best_buy' },
  { canonical: 'brawlstars', fallback: 'brawl_stars' },
  { canonical: 'characterai', fallback: 'character_ai' },
  { canonical: 'capitalone', fallback: 'capital_one' },
  { canonical: 'newsbreak', fallback: 'news_break' },
  { canonical: 'pizzahut', fallback: 'pizza_hut' },
  { canonical: 'sleepcycle', fallback: 'sleep_cycle' },
  { canonical: 'torbrowser', fallback: 'tor_browser' },
  { canonical: 'totalcommander', fallback: 'total_commander' },
  { canonical: 'vampiresurvivors', fallback: 'vampire_survivors' },
  { canonical: 'zohomail', fallback: 'zoho_mail' },
  { canonical: 'lastfm', fallback: 'last_fm' },
  { canonical: 'kiwibrowser', fallback: 'kiwi_browser' },
  { canonical: 'plagueinc', fallback: 'plague_inc' },
  { canonical: 'tripcom', fallback: 'trip_com' },
  { canonical: 'twitter', fallback: 'x' },
];

const NON_ICON = new Set([
  'ic_disco_back',
  'ic_disco_mask',
  'ic_disco_upon',
  'ic_disco_back_1',
  'iconback',
  'iconmask',
  'iconupon',
]);

async function main() {
  console.log('======================================================');
  console.log('🔄 STANDARDIZING DISCO ICON PACK (NO IC_DISCO PREFIX)');
  console.log('======================================================');

  // STEP 1: Normalize filenames in assets/icons-src
  console.log('\n--- Step 1: Normalizing assets/icons-src ---');
  if (fs.existsSync(iconsSrcDir)) {
    const srcFiles = fs.readdirSync(iconsSrcDir).filter((f) => f.endsWith('.webp') || f.endsWith('.png'));
    for (const file of srcFiles) {
      const ext = path.extname(file);
      let base = path.basename(file, ext);

      // Strip ic_disco_ if present
      if (base.startsWith('ic_disco_')) {
        base = base.replace(/^ic_disco_/, '');
      }

      // Replace hyphens with underscores
      if (base.includes('-')) {
        base = base.replace(/-/g, '_');
      }

      // Rename legacy slug if in map
      if (LEGACY_SLUG_RENAMES[base]) {
        base = LEGACY_SLUG_RENAMES[base];
      }

      // Add leading underscore to numeric slugs
      if (/^[0-9]/.test(base)) {
        base = `_${base}`;
      }

      const newFilename = `${base}${ext}`;
      if (newFilename !== file) {
        const oldP = path.join(iconsSrcDir, file);
        const newP = path.join(iconsSrcDir, newFilename);
        if (!fs.existsSync(newP)) {
          fs.renameSync(oldP, newP);
          console.log(`Renamed in icons-src: ${file} -> ${newFilename}`);
        } else {
          fs.unlinkSync(oldP);
          console.log(`Removed duplicate in icons-src: ${file}`);
        }
      }
    }
  }

  // Ensure disco self-theme icon exists
  const discoIconSrc = path.join(iconsSrcDir, 'disco.webp');
  if (!fs.existsSync(discoIconSrc) && fs.existsSync(logoPath)) {
    fs.copyFileSync(logoPath, discoIconSrc);
    console.log('Created disco.webp for self-theming from logo.webp');
  }

  // STEP 2: Harmonize canonical pairs in assets/icons-src
  console.log('\n--- Step 2: Harmonizing canonical pairs in icons-src ---');
  for (const pair of CORE_CANONICAL_PAIRS) {
    const canP = path.join(iconsSrcDir, `${pair.canonical}.webp`);
    const fallP = path.join(iconsSrcDir, `${pair.fallback}.webp`);

    if (fs.existsSync(fallP) && !fs.existsSync(canP)) {
      fs.copyFileSync(fallP, canP);
      console.log(`Created canonical: ${pair.canonical}.webp (from ${pair.fallback}.webp)`);
    } else if (fs.existsSync(canP) && !fs.existsSync(fallP)) {
      fs.copyFileSync(canP, fallP);
      console.log(`Created fallback: ${pair.fallback}.webp (from ${pair.canonical}.webp)`);
    }
  }

  // STEP 3: Normalize android/app/src/main/res/drawable-nodpi
  console.log('\n--- Step 3: Eliminating ic_disco_ from drawable-nodpi ---');
  if (fs.existsSync(drawableNodpiDir)) {
    const nodpiFiles = fs.readdirSync(drawableNodpiDir).filter((f) => f.endsWith('.webp'));
    for (const file of nodpiFiles) {
      const ext = path.extname(file);
      let base = path.basename(file, ext);

      // Keep non-icon drawables (like ic_disco_back)
      if (NON_ICON.has(base) || base.startsWith('ic_disco_symbol_')) continue;

      let newBase = base;
      if (newBase.startsWith('ic_disco_')) {
        newBase = newBase.replace(/^ic_disco_/, '');
      }
      if (newBase.includes('-')) {
        newBase = newBase.replace(/-/g, '_');
      }
      if (LEGACY_SLUG_RENAMES[newBase]) {
        newBase = LEGACY_SLUG_RENAMES[newBase];
      }
      if (/^[0-9]/.test(newBase)) {
        newBase = `_${newBase}`;
      }

      if (newBase !== base) {
        const oldP = path.join(drawableNodpiDir, file);
        const newP = path.join(drawableNodpiDir, `${newBase}${ext}`);
        if (!fs.existsSync(newP)) {
          fs.renameSync(oldP, newP);
        } else {
          fs.unlinkSync(oldP);
        }
      }
    }

    // Sync all canonical pairs to drawable-nodpi
    for (const pair of CORE_CANONICAL_PAIRS) {
      const canP = path.join(drawableNodpiDir, `${pair.canonical}.webp`);
      const fallP = path.join(drawableNodpiDir, `${pair.fallback}.webp`);

      if (fs.existsSync(fallP) && !fs.existsSync(canP)) {
        fs.copyFileSync(fallP, canP);
      } else if (fs.existsSync(canP) && !fs.existsSync(fallP)) {
        fs.copyFileSync(canP, fallP);
      }
    }

    // Also ensure every file in assets/icons-src is mirrored to drawable-nodpi
    const currentSrc = fs.readdirSync(iconsSrcDir).filter((f) => f.endsWith('.webp'));
    for (const f of currentSrc) {
      const destP = path.join(drawableNodpiDir, f);
      if (!fs.existsSync(destP)) {
        fs.copyFileSync(path.join(iconsSrcDir, f), destP);
      }
    }
  }

  // STEP 4: Parse Arcticons & Fluffy & Spidey Datasets
  console.log('\n--- Step 4: Loading Arcticons & Fluffy Component Mappings ---');
  const fullXml = await fsp.readFile(masterXmlPath, 'utf8');
  const arcticonsMappings = [];
  const itemRegex = /<item\s+component="([^"]+)"\s+drawable="([^"]+)"/g;
  let match;
  while ((match = itemRegex.exec(fullXml)) !== null) {
    arcticonsMappings.push({ component: match[1], drawable: match[2] });
  }

  const master3kRaw = JSON.parse(await fsp.readFile(masterJsonPath, 'utf8'));
  const master3k = Array.isArray(master3kRaw) ? master3kRaw : (master3kRaw.apps || []);
  for (const app of master3k) {
    for (const comp of app.components || []) {
      arcticonsMappings.push({ component: comp, drawable: app.slug });
    }
  }

  // Load Fluffy mappings (primary source of truth)
  const fluffyPackPath = '/Users/nazeer/Desktop/icon packs/Fluffy/config/icon-pack.json';
  if (fs.existsSync(fluffyPackPath)) {
    try {
      const fl = JSON.parse(fs.readFileSync(fluffyPackPath, 'utf8'));
      (fl.mappings || []).forEach((m) => {
        const cleanDraw = m.drawable.replace(/^ic_fluffy_/, '').replace(/-/g, '_');
        arcticonsMappings.push({ component: m.component, drawable: cleanDraw });
      });
      console.log(`Loaded ${fl.mappings ? fl.mappings.length : 0} mappings from Fluffy.`);
    } catch (e) {}
  }

  // Load Spidey mappings
  const spideyPackPath = '/Users/nazeer/Desktop/icon packs/spidey-icon-pack/config/icon-pack.json';
  if (fs.existsSync(spideyPackPath)) {
    try {
      const sp = JSON.parse(fs.readFileSync(spideyPackPath, 'utf8'));
      (sp.mappings || []).forEach((m) => {
        const cleanDraw = m.drawable.replace(/^ic_spidey_/, '').replace(/-/g, '_');
        arcticonsMappings.push({ component: m.component, drawable: cleanDraw });
      });
      console.log(`Loaded ${sp.mappings ? sp.mappings.length : 0} mappings from Spidey.`);
    } catch (e) {}
  }

  // Disco own-app mappings (for launcher self-theming)
  const DISCO_OWN_APP_MAPPINGS = [
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.iconpack.MainActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.MainActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/.MainActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.launcher.IconPickerActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.iconpack.launcher.IconPickerActivity}', drawable: 'disco' },
  ];
  for (const m of DISCO_OWN_APP_MAPPINGS) {
    arcticonsMappings.push(m);
  }

  // STEP 5: Rebuild Mappings for Shipped Drawables
  console.log('\n--- Step 5: Binding Shipped Drawables to Component Mappings ---');
  const availableDrawables = new Set(
    fs
      .readdirSync(iconsSrcDir)
      .filter((f) => f.endsWith('.webp'))
      .map((f) => path.basename(f, '.webp'))
      .filter((d) => !NON_ICON.has(d))
  );

  console.log(`Total available drawables: ${availableDrawables.size}`);

  const usedComponents = new Set();
  const newMappings = [];
  const mappedDrawables = new Set();

  for (const m of arcticonsMappings) {
    let target = null;
    const d = m.drawable;
    const dUnder = d.replace(/-/g, '_');
    const dLeadUnder = `_${dUnder}`;

    if (availableDrawables.has(d)) target = d;
    else if (availableDrawables.has(dUnder)) target = dUnder;
    else if (availableDrawables.has(dLeadUnder)) target = dLeadUnder;

    if (target && !usedComponents.has(m.component)) {
      usedComponents.add(m.component);
      newMappings.push({ component: m.component, drawable: target });
      mappedDrawables.add(target);
    }
  }

  // Check for any unmapped drawables
  const unmapped = [];
  for (const d of availableDrawables) {
    if (!mappedDrawables.has(d)) {
      unmapped.push(d);
    }
  }

  if (unmapped.length > 0) {
    console.log(`⚠️ Found ${unmapped.length} unmapped drawables:`, unmapped);
    for (const u of unmapped) {
      const srcF = path.join(iconsSrcDir, `${u}.webp`);
      const nodpiF = path.join(drawableNodpiDir, `${u}.webp`);
      if (fs.existsSync(srcF)) fs.unlinkSync(srcF);
      if (fs.existsSync(nodpiF)) fs.unlinkSync(nodpiF);
      availableDrawables.delete(u);
      console.log(`Purged 0-mapping icon: ${u}`);
    }
  }

  // Build drawables dictionary
  const drawablesMap = {};
  for (const d of Array.from(availableDrawables).sort()) {
    drawablesMap[d] = {
      template: 'raster',
      rasterSource: d,
      rasterDrawable: d,
      includeBase: false,
    };
  }

  newMappings.sort((a, b) => a.drawable.localeCompare(b.drawable) || a.component.localeCompare(b.component));

  // STEP 6: Save updated config/icon-pack.json
  console.log('\n--- Step 6: Writing config/icon-pack.json & config/icons.json ---');
  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {}
  }
  cfg.drawables = drawablesMap;
  cfg.mappings = newMappings;
  await fsp.writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf8');

  // Update config/icons.json
  const iconsList = Array.from(availableDrawables).sort().map((d) => ({
    name: d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    slug: d,
  }));
  await fsp.writeFile(iconsJsonPath, JSON.stringify({ apps: iconsList }, null, 2), 'utf8');

  console.log('\n======================================================');
  console.log(`✅ STANDARDIZATION COMPLETE:`);
  console.log(`   Shipped Drawables:          ${availableDrawables.size}`);
  console.log(`   Verified Component Mappings: ${newMappings.length}`);
  console.log(`   0-mapping ghost icons:      0`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
