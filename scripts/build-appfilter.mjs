#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config', 'icon-pack.json');
const drawableDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');

const NON_ICON = new Set([
  'ic_disco_back',
  'ic_disco_mask',
  'ic_disco_upon',
  'ic_disco_back_1',
  'iconback',
  'iconmask',
  'iconupon',
]);

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const cfg = JSON.parse(await fsp.readFile(configPath, 'utf8'));

  // All shipped webp drawables
  const shippedDrawables = fs.existsSync(drawableDir)
    ? fs
        .readdirSync(drawableDir)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => path.basename(f, path.extname(f)))
        .filter((name) => !NON_ICON.has(name) && !name.startsWith('ic_disco_symbol_'))
    : [];

  const srcDrawables = fs.existsSync(path.join(root, 'assets', 'icons-src'))
    ? fs
        .readdirSync(path.join(root, 'assets', 'icons-src'))
        .filter((f) => f.endsWith('.webp'))
        .map((f) => path.basename(f, path.extname(f)))
        .filter((name) => !NON_ICON.has(name) && !name.startsWith('ic_disco_symbol_'))
    : [];

  const validDrawablesSet = new Set([...shippedDrawables, ...srcDrawables]);
  if (validDrawablesSet.size === 0) {
    Object.keys(cfg.drawables || {}).forEach((d) => {
      if (!NON_ICON.has(d) && !d.startsWith('ic_disco_symbol_')) {
        validDrawablesSet.add(d);
      }
    });
  }

  const sortedDrawables = Array.from(validDrawablesSet).sort();

  // Disco own-app mappings (for launcher self-theming)
  const DISCO_OWN_APP_MAPPINGS = [
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.iconpack.MainActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.MainActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/.MainActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.launcher.IconPickerActivity}', drawable: 'disco' },
    { component: 'ComponentInfo{com.disco.iconpack/com.disco.iconpack.launcher.IconPickerActivity}', drawable: 'disco' },
  ];

  // Mappings
  const rawMappings = cfg.mappings || [];
  const existingMappingKeys = new Set(rawMappings.map((m) => `${m.component}|${m.drawable}`));
  for (const om of DISCO_OWN_APP_MAPPINGS) {
    const key = `${om.component}|${om.drawable}`;
    if (!existingMappingKeys.has(key) && validDrawablesSet.has(om.drawable)) {
      rawMappings.push(om);
      existingMappingKeys.add(key);
    }
  }

  const validMappings = rawMappings.filter((m) => validDrawablesSet.has(m.drawable));

  // 1. Build appfilter.xml
  const appfilterLines = validMappings
    .map((m) => `    <item component="${xmlEscape(m.component)}" drawable="${m.drawable}" />`)
    .join('\n');
  const appfilterXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <version>1</version>
    <iconback img1="ic_disco_back" />
    <scale factor="0.80" />
${appfilterLines}
</resources>\n`;

  const appfilterPaths = [
    path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'appfilter.xml'),
    path.join(root, 'android', 'app', 'src', 'main', 'assets', 'appfilter.xml'),
  ];
  for (const out of appfilterPaths) {
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, appfilterXml, 'utf8');
  }

  // 2. Build drawable.xml (4 Semantic Categories: System, Google, Games, Apps)
  const SYSTEM_SET = new Set([
    'calculator', 'calendar', 'calendar_31', 'camera', 'clock', 'contacts',
    'downloads', 'feedback', 'gallery', 'lineage_settings', 'messages', 'messages_2',
    'phone', 'phone_2', 'retro_music', 'settings', 'sound_recorder', 'voice_recorder',
    'google_calculator', 'google_calendar', 'google_camera', 'google_clock',
    'google_contacts', 'google_messages', 'google_phone'
  ]);

  const GOOGLE_SET = new Set([
    'chrome', 'drive', 'gmail', 'google_drive', 'google_earth', 'google_fit',
    'google_home', 'google_keep', 'google_lens', 'google_maps', 'google_meet',
    'google_news', 'google_one', 'google_pay', 'google_photos', 'google_play',
    'google_play_store', 'google_podcasts', 'google_tv', 'google_voice',
    'google_wallet', 'maps', 'photos', 'playstore', 'youtube', 'youtube_music',
    'google_chrome', 'google_mail'
  ]);

  const GAME_SET = new Set([
    '_2048', '_8_ball_pool', 'amongus', 'among_us', 'asphalt_9', 'brawlstars',
    'brawl_stars', 'candy_crush_saga', 'clash_of_clans', 'clash_royale',
    'genshin_impact', 'minecraft', 'pokemon_go', 'pubg', 'roblox', 'subway_surfers'
  ]);

  const catSystem = [];
  const catGoogle = [];
  const catGames = [];
  const catApps = [];

  for (const d of sortedDrawables) {
    if (GOOGLE_SET.has(d) || d.startsWith('google_') || d.startsWith('youtube')) {
      catGoogle.push(d);
    } else if (SYSTEM_SET.has(d)) {
      catSystem.push(d);
    } else if (GAME_SET.has(d)) {
      catGames.push(d);
    } else {
      catApps.push(d);
    }
  }

  let drawableXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <version>1</version>
`;

  const addCategory = (title, list) => {
    if (!list.length) return;
    drawableXml += `\n    <category title="${title}" />\n`;
    for (const d of list) {
      drawableXml += `    <item drawable="${d}" />\n`;
    }
  };

  addCategory('System', catSystem);
  addCategory('Google', catGoogle);
  addCategory('Games', catGames);
  addCategory('Apps', catApps);
  drawableXml += `</resources>\n`;

  const drawablePaths = [
    path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'drawable.xml'),
    path.join(root, 'android', 'app', 'src', 'main', 'assets', 'drawable.xml'),
  ];
  for (const out of drawablePaths) {
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, drawableXml, 'utf8');
  }

  // 3. Build icon_pack.xml
  const iconPackXmlLines = sortedDrawables.map((d) => `        <item>${d}</item>`).join('\n');
  const iconPackXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string-array name="icon_pack" translatable="false">
${iconPackXmlLines}
    </string-array>
</resources>\n`;

  const iconPackPaths = [
    path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'icon_pack.xml'),
    path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'icon_pack.xml'),
    path.join(root, 'android', 'app', 'src', 'main', 'assets', 'icon_pack.xml'),
  ];
  for (const out of iconPackPaths) {
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, iconPackXml, 'utf8');
  }

  // 4. Build theme_resources.xml
  const themeAppfilterLines = validMappings
    .map((m) => `    <AppIcon component="${xmlEscape(m.component)}" image="${m.drawable}" />`)
    .join('\n');
  const themeXml = `<?xml version="1.0" encoding="utf-8"?>
<theme-resources>
    <version>1</version>
    <label>Disco</label>
    <iconback img1="ic_disco_back" />
    <scale factor="0.80" />
${themeAppfilterLines}
</theme-resources>\n`;

  const themePaths = [
    path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'theme_resources.xml'),
    path.join(root, 'android', 'app', 'src', 'main', 'assets', 'theme_resources.xml'),
  ];
  for (const out of themePaths) {
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, themeXml, 'utf8');
  }

  // 5. Build appmap.xml
  const appmapItems = validMappings
    .map((m) => {
      const match = m.component.match(/ComponentInfo\{[^/]+\/([^}]+)\}/);
      const className = match ? match[1] : '';
      if (!className) return null;
      return `    <item class="${xmlEscape(className)}" drawable="${m.drawable}" />`;
    })
    .filter(Boolean)
    .join('\n');
  const appmapXml = `<?xml version="1.0" encoding="utf-8"?>
<appmap>
${appmapItems}
</appmap>\n`;

  const appmapPaths = [
    path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml', 'appmap.xml'),
    path.join(root, 'android', 'app', 'src', 'main', 'assets', 'appmap.xml'),
  ];
  for (const out of appmapPaths) {
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, appmapXml, 'utf8');
  }

  console.log(`[launcher-sync] Generated appfilter.xml (${validMappings.length} mappings), drawable.xml (${sortedDrawables.length} drawables in 4 categories), icon_pack.xml, theme_resources.xml, and appmap.xml across res/xml, assets, and res/values.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
