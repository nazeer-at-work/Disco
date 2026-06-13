#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Buffer } = require('buffer');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'config', 'icon-pack.json');
const rasterSourceDir = path.join(root, 'assets', 'icons-src');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const drawableDir = path.join(resDir, 'drawable');
const drawableNoDpiDir = path.join(resDir, 'drawable-nodpi');
const densityDirs = ['drawable-mdpi', 'drawable-hdpi', 'drawable-xhdpi', 'drawable-xxhdpi', 'drawable-xxxhdpi'];
const xmlDir = path.join(resDir, 'xml');
const assetsDir = path.join(root, 'android', 'app', 'src', 'main', 'assets');

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const onlyNew = process.argv.includes('--only-new');
const skipAppfilter = process.argv.includes('--skip-appfilter');
const drawableDefaults = {
  color: '#8FB3FF',
  symbol: 'settings',
  template: 'raster',
  includeBase: false,
  rasterInsetDp: 0,
  rasterSizeDp: 0,
  ...(cfg.drawableDefaults || {}),
};

// Size guardrails: launcher icons render at <=192dp, so a ~384px source is plenty.
// Capping resolution + webp quality here is what keeps the APK flat as the icon
// count grows (a 1024px/quality-100 master is ~100x bigger than it needs to be).
const MAX_ICON_PX = Number(cfg.iconStyle && cfg.iconStyle.maxIconPx) || 384;
const WEBP_QUALITY = Number(cfg.iconStyle && cfg.iconStyle.webpQuality) || 80;
// Uniform sizing: every icon is normalized onto a MAX_ICON_PX square canvas with
// its longest edge scaled to CONTENT_SCALE of the canvas and centered. This is what
// makes the grid + home screen look consistent regardless of each source's aspect
// ratio or how the generator framed it. Rounded "container" icons fill more.
const CONTENT_SCALE = Number(cfg.iconStyle && cfg.iconStyle.contentScale) || 0.82;
const ROUNDED_CONTENT_SCALE =
  Number(cfg.iconStyle && cfg.iconStyle.roundedContentScale) || 0.94;

const symbolPaths = {
  phone: 'M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  message: 'M4 5h16c1.1 0 2 .9 2 2v12l-4-3H4c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2z',
  camera: 'M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z',
  folder: 'M3 6c0-1.1.9-2 2-2h5l2 2h7c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6z',
  calendar: 'M7 2h2v2h6V2h2v2h2c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h2V2zm12 8H5v8h14v-8z',
  music: 'M14 3v9.55A3.5 3.5 0 1 0 16 16V7h5V3h-7z',
  play: 'M8 5v14l11-7L8 5z',
  browser: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c1.68 0 3.2.64 4.34 1.69H7.66A7.95 7.95 0 0 1 12 4zm-6.93 4h13.86A8 8 0 0 1 20 12h-4.5c-.4 0-.75.24-.9.6L13 16H8l1.2-3.2A1 1 0 0 0 8.26 11H4.4c.26-1.1.82-2.09 1.67-3z',
  maps: 'M12 2C8.13 2 5 5.09 5 8.91c0 5.2 7 13.09 7 13.09s7-7.89 7-13.09C19 5.09 15.87 2 12 2zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z',
  contacts: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.33 0-7 1.67-7 4v2h14v-2c0-2.33-3.67-4-7-4z',
  settings: 'M19.43 12.98l1.34-1.04-1.5-2.6-1.64.66a5.84 5.84 0 0 0-1.18-.69l-.25-1.74h-3l-.25 1.74c-.42.16-.82.39-1.18.69l-1.64-.66-1.5 2.6 1.34 1.04c-.03.23-.05.47-.05.72s.02.49.05.72l-1.34 1.04 1.5 2.6 1.64-.66c.36.3.76.53 1.18.69l.25 1.74h3l.25-1.74c.42-.16.82-.39 1.18-.69l1.64.66 1.5-2.6-1.34-1.04c.03-.23.05-.47.05-.72s-.02-.49-.05-.72zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z',
  calculator: 'M6 3h12c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm1 3v3h10V6H7zm0 5v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zM7 15v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z',
  gallery: 'M4 5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v14l-4.5-4.5-3.5 3.5-2.5-2.5L4 19V5zm4.5 5A1.5 1.5 0 1 0 8.5 7a1.5 1.5 0 0 0 0 3z',
  mail: 'M3 6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6zm2 1v.5l7 4.5 7-4.5V7l-7 4.5L5 7z'
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, `${content}\n`, 'utf8');
}

function toItemLines(mappings) {
  return mappings.map((m) => `    <item component="${m.component}" drawable="${m.drawable}" />`).join('\n');
}

function normalizeDrawableConfig(entry) {
  if (typeof entry === 'string') {
    return {
      color: entry,
      ...drawableDefaults,
    };
  }

  return { ...drawableDefaults, ...entry };
}

function buildAppFilter(mappings) {
  const items = toItemLines(mappings);
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
${items}
</resources>`;
}

function buildBackDrawable() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="${cfg.base.cornerRadiusDp}dp" />
    <gradient
        android:angle="315"
        android:startColor="${cfg.base.gradientStart}"
        android:centerColor="${cfg.base.gradientCenter}"
        android:endColor="${cfg.base.gradientEnd}" />
</shape>`;
}

function buildMaskDrawable() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFFFF" />
    <corners android:radius="${cfg.base.cornerRadiusDp}dp" />
</shape>`;
}

function buildUponDrawable() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="${cfg.base.cornerRadiusDp}dp" />
    <gradient
        android:angle="270"
        android:startColor="#00FFFFFF"
        android:endColor="#26FFFFFF" />
</shape>`;
}

function buildSymbolVector(symbolName) {
  const pathData = symbolPaths[symbolName] || symbolPaths.settings;
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="${cfg.iconStyle.glyphColor}"
        android:pathData="${pathData}" />
</vector>`;
}

function buildIconDrawable(color, symbolName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/ic_disco_back" />

    <item android:left="${cfg.iconStyle.blobInsetDp}dp" android:top="${cfg.iconStyle.blobInsetDp}dp" android:right="${cfg.iconStyle.blobInsetDp}dp" android:bottom="${cfg.iconStyle.blobInsetDp}dp">
        <shape android:shape="oval">
            <gradient
                android:angle="315"
                android:startColor="${color}"
                android:endColor="#FFFFFFFF" />
            <stroke android:width="2dp" android:color="${cfg.iconStyle.strokeColor}" />
        </shape>
    </item>

    <item android:left="${cfg.iconStyle.highlightLeftDp}dp" android:top="${cfg.iconStyle.highlightTopDp}dp" android:right="${cfg.iconStyle.highlightRightDp}dp" android:bottom="${cfg.iconStyle.highlightBottomDp}dp">
        <shape android:shape="oval">
            <solid android:color="${cfg.iconStyle.highlightColor}" />
        </shape>
    </item>

    <item
        android:gravity="center"
        android:width="${cfg.iconStyle.glyphSizeDp}dp"
        android:height="${cfg.iconStyle.glyphSizeDp}dp"
        android:drawable="@drawable/ic_disco_symbol_${symbolName}" />
</layer-list>`;
}

function buildCameraFuzzyDrawable(color) {
  return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/ic_disco_back" />

    <item android:left="8dp" android:top="10dp" android:right="8dp" android:bottom="10dp">
        <shape android:shape="rectangle">
            <corners android:radius="16dp" />
            <gradient
                android:angle="270"
                android:startColor="#343A47"
                android:centerColor="#2A2F3A"
                android:endColor="#181C24" />
            <stroke android:width="1dp" android:color="#44FFFFFF" />
        </shape>
    </item>

    <item android:left="14dp" android:top="16dp" android:right="42dp" android:bottom="44dp">
        <shape android:shape="oval">
            <gradient
                android:angle="315"
                android:startColor="#FFF6A6"
                android:centerColor="#87F7FF"
                android:endColor="#FF85D9" />
        </shape>
    </item>

    <item android:left="13dp" android:top="15dp" android:right="41dp" android:bottom="43dp">
        <shape android:shape="oval">
            <stroke android:width="1dp" android:color="#66FFFFFF" />
            <solid android:color="#00FFFFFF" />
        </shape>
    </item>

    <item android:left="22dp" android:top="24dp" android:right="22dp" android:bottom="24dp">
        <shape android:shape="oval">
            <solid android:color="#F2F7FF" />
        </shape>
    </item>

    <item android:left="26dp" android:top="28dp" android:right="26dp" android:bottom="28dp">
        <shape android:shape="oval">
            <gradient
                android:angle="315"
                android:startColor="#BBD0FF"
                android:centerColor="#536FB0"
                android:endColor="#141D31" />
            <stroke android:width="1dp" android:color="#55FFFFFF" />
        </shape>
    </item>

    <item android:left="30dp" android:top="32dp" android:right="30dp" android:bottom="32dp">
        <shape android:shape="oval">
            <gradient
                android:angle="300"
                android:startColor="#84D5FF"
                android:centerColor="#283D6A"
                android:endColor="#02040A" />
        </shape>
    </item>

    <item android:left="34dp" android:top="36dp" android:right="34dp" android:bottom="36dp">
        <shape android:shape="oval">
            <gradient
                android:angle="300"
                android:startColor="#99E4FF"
                android:endColor="#090E1A" />
        </shape>
    </item>

    <item android:left="34dp" android:top="36dp" android:right="34dp" android:bottom="36dp">
        <shape android:shape="oval">
            <stroke android:width="1dp" android:color="#33FFFFFF" />
            <solid android:color="#00FFFFFF" />
        </shape>
    </item>

    <item android:left="43dp" android:top="44dp" android:right="43dp" android:bottom="44dp">
        <shape android:shape="oval">
            <solid android:color="#0A1020" />
        </shape>
    </item>

    <item android:left="36dp" android:top="40dp" android:right="48dp" android:bottom="52dp">
        <shape android:shape="oval">
            <solid android:color="#99FFFFFF" />
        </shape>
    </item>

    <item android:left="20dp" android:top="18dp" android:right="62dp" android:bottom="60dp">
        <shape android:shape="oval">
            <solid android:color="#66FFFFFF" />
        </shape>
    </item>

    <item android:left="66dp" android:top="18dp" android:right="16dp" android:bottom="66dp">
        <shape android:shape="oval">
            <gradient
                android:angle="270"
                android:startColor="#FFFFFF"
                android:endColor="${color}" />
        </shape>
    </item>
</layer-list>`;
}

function getRasterBaseCandidates(rasterDrawable, entry = {}, iconName = '') {
  const bases = new Set();
  const add = (v) => {
    if (typeof v === 'string' && v.trim()) {
      bases.add(v.trim());
    }
  };

  add(entry.rasterSource);
  add(rasterDrawable);
  add(iconName);
  add(iconName.replace(/^ic_disco_/, ''));

  Array.from(bases).forEach((base) => {
    add(base.replace(/^ic_disco_/, ''));
    add(base.replace(/_custom$/, ''));
    add(`ic_disco_${base}`);
    add(`${base}_custom`);
    add(`ic_disco_${base}_custom`);
  });

  return Array.from(bases);
}

function hasSourceForSimpleName(simpleName, availableBases) {
  if (availableBases.has(simpleName)) {
    return simpleName;
  }

  const aliases = {
    gallery: ['photos', 'photo'],
    playstore: ['play_store', 'play-store', 'playstore'],
    contacts: ['contact'],
    message: ['messages', 'sms'],
    phone: ['dialer', 'call'],
  };

  const candidates = aliases[simpleName] || [];
  for (const candidate of candidates) {
    if (availableBases.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveRasterSourcePath(rasterDrawable, entry = {}, iconName = '') {
  const bases = getRasterBaseCandidates(rasterDrawable, entry, iconName);
  const sourceCandidates = [];
  const fallbackCandidates = [];

  // Always prefer canonical sources from assets/icon-pack-src.
  // Reusing drawable-nodpi first can lock in stale generated files.
  bases.forEach((base) => {
    sourceCandidates.push(path.join(rasterSourceDir, `${base}.webp`));
    sourceCandidates.push(path.join(rasterSourceDir, `${base}.png`));
    fallbackCandidates.push(path.join(drawableNoDpiDir, `${base}.webp`));
    fallbackCandidates.push(path.join(drawableNoDpiDir, `${base}.png`));
  });

  const candidates = [...sourceCandidates, ...fallbackCandidates];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function removeRasterFromDensityDrawables(targetDrawableName) {
  const rasterExts = ['.png', '.webp'];
  densityDirs.forEach((dirName) => {
    const dirPath = path.join(resDir, dirName);
    rasterExts.forEach((ext) => {
      removeIfExists(path.join(dirPath, `${targetDrawableName}${ext}`));
    });
  });
}

function hasRoundedRasterConfig(entry = {}) {
  const pct = Number(entry.rasterCornerRadiusPct ?? entry.rasterCornerRadiusPercent ?? 0);
  return Boolean(entry.rasterRoundCorners) || Number.isFinite(pct) && pct > 0;
}

function getRoundedRasterRadiusPx(entry = {}, width, height) {
  const pct = Number(entry.rasterCornerRadiusPct ?? entry.rasterCornerRadiusPercent ?? 0);
  const ratio = Number.isFinite(pct) && pct > 0 ? pct / 100 : 0.22;
  return Math.max(1, Math.round(Math.min(width, height) * ratio));
}

// Normalize one source into a uniform, centered icon: trim transparent padding,
// scale the content's longest edge to `scale` of the MAX_ICON_PX square canvas,
// (optionally) round its corners, then center it on a transparent square canvas.
// Output is ALWAYS MAX_ICON_PX x MAX_ICON_PX so every drawable renders the same
// size in the grid and on the launcher.
async function writeNormalizedRaster(sourcePath, targetPath, entry = {}, { rounded } = {}) {
  const canvas = MAX_ICON_PX;
  const requestedScale = Number(entry.contentScale);
  const scale = Number.isFinite(requestedScale) && requestedScale > 0
    ? requestedScale
    : rounded ? ROUNDED_CONTENT_SCALE : CONTENT_SCALE;
  const box = Math.max(1, Math.round(canvas * scale));

  // Fit the trimmed content inside the content box (longest edge == box).
  // Enlargement is allowed so low-res sources still fill the uniform footprint.
  const fitted = await sharp(sourcePath)
    .trim()
    .resize({ width: box, height: box, fit: 'inside' })
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  let layer = fitted.data;
  if (rounded) {
    const w = fitted.info.width || box;
    const h = fitted.info.height || box;
    const radius = getRoundedRasterRadiusPx(entry, w, h);
    const maskSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="white"/></svg>`;
    layer = await sharp(fitted.data)
      .ensureAlpha()
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: layer, gravity: 'center' }])
    .webp({ quality: WEBP_QUALITY, effort: 6, alphaQuality: 100 })
    .toFile(targetPath);
}

async function copyRasterIntoDrawableNoDpi(sourcePath, targetDrawableName, entry = {}) {
  // Always emit webp: forces recompression/downscaling even for .png sources, so
  // no oversized master can slip into the bundle verbatim.
  const targetPath = path.join(drawableNoDpiDir, `${targetDrawableName}.webp`);
  const sameFile = path.resolve(sourcePath) === path.resolve(targetPath);
  const targetExists = fs.existsSync(targetPath);
  const rounded = hasRoundedRasterConfig(entry);

  if (sameFile) {
    // Source is already the target drawable-nodpi file; nothing to copy.
    return;
  }

  if (onlyNew && targetExists) {
    const sourceStat = fs.statSync(sourcePath);
    const targetStat = fs.statSync(targetPath);
    if (targetStat.mtimeMs >= sourceStat.mtimeMs) {
      return;
    }
  }

  removeRasterFromDensityDrawables(targetDrawableName);
  removeIfExists(path.join(drawableNoDpiDir, `${targetDrawableName}.png`));
  removeIfExists(path.join(drawableNoDpiDir, `${targetDrawableName}.webp`));

  await writeNormalizedRaster(sourcePath, targetPath, entry, { rounded });
}

async function main() {
  ensureDir(drawableDir);
  ensureDir(drawableNoDpiDir);
  ensureDir(rasterSourceDir);
  densityDirs.forEach((dirName) => ensureDir(path.join(resDir, dirName)));
  ensureDir(xmlDir);
  ensureDir(assetsDir);

  const sourceFiles = fs
    .readdirSync(rasterSourceDir)
    .filter((f) => /\.(png|webp)$/i.test(f));
  const sourceBases = new Set(
    sourceFiles.map((f) => path.basename(f, path.extname(f)).toLowerCase()),
  );

  writeFile(path.join(drawableDir, 'ic_disco_back.xml'), buildBackDrawable());
  writeFile(path.join(drawableDir, 'ic_disco_mask.xml'), buildMaskDrawable());
  writeFile(path.join(drawableDir, 'ic_disco_upon.xml'), buildUponDrawable());

  const usedSymbols = new Set();
  const unavailableDrawables = new Set();

  // Auto-discover: every source image in assets/icons-src becomes a raster
  // drawable (ic_disco_<slug>), so adding an icon is just "generate then build"
  // with no need to hand-edit config/icon-pack.json. Explicit entries in
  // cfg.drawables still win and can carry per-icon overrides (rounding, etc.).
  const drawableEntries = { ...(cfg.drawables || {}) };
  for (const base of sourceBases) {
    const drawableName = `ic_disco_${base.replace(/-/g, '_')}`;
    if (!drawableEntries[drawableName]) {
      drawableEntries[drawableName] = { template: 'raster', rasterSource: base };
    }
  }

  for (const [name, raw] of Object.entries(drawableEntries)) {
    const entry = normalizeDrawableConfig(raw);
    entry.rasterDrawable = entry.rasterDrawable || name;
    const symbolName = entry.symbol || 'settings';
    let template = entry.template || 'blobSymbol';

    if (template !== 'raster') {
      const simpleName = name.replace(/^ic_disco_/, '');
      const aliasBase = hasSourceForSimpleName(simpleName, sourceBases);
      if (aliasBase) {
        entry.template = 'raster';
        entry.rasterSource = aliasBase;
        entry.rasterDrawable = name;
        entry.includeBase = false;
        template = 'raster';
      }
    }

    if (template === 'raster') {
      const rasterDrawable = entry.rasterDrawable;
      const sourcePath = resolveRasterSourcePath(rasterDrawable, entry, name);
      if (rasterDrawable && sourcePath) {
        await copyRasterIntoDrawableNoDpi(sourcePath, name, entry);
        removeIfExists(path.join(drawableDir, `${name}.xml`));
        removeIfExists(path.join(drawableDir, `${rasterDrawable}_fit.xml`));
        continue;
      }

      console.warn(
        `[icon-pack] Missing raster for ${name}. Drawable will be skipped so launcher can fall back to original app icon.`,
      );
      unavailableDrawables.add(name);
      removeIfExists(path.join(drawableDir, `${name}.xml`));
      removeIfExists(path.join(drawableNoDpiDir, `${name}.png`));
      removeIfExists(path.join(drawableNoDpiDir, `${name}.webp`));
      removeIfExists(path.join(drawableNoDpiDir, `${name}.xml`));
      removeRasterFromDensityDrawables(name);
      continue;
    }

    if (template === 'cameraFuzzy') {
      writeFile(path.join(drawableDir, `${name}.xml`), buildCameraFuzzyDrawable(entry.color));
      continue;
    }

    usedSymbols.add(symbolName);
    writeFile(
      path.join(drawableDir, `${name}.xml`),
      buildIconDrawable(entry.color, symbolName),
    );
  }

  Array.from(usedSymbols).forEach((symbolName) => {
    writeFile(
      path.join(drawableDir, `ic_disco_symbol_${symbolName}.xml`),
      buildSymbolVector(symbolName),
    );
  });

  const filteredMappings = (cfg.mappings || []).filter(
    (mapping) => !unavailableDrawables.has(mapping.drawable),
  );
  const skippedMappings = (cfg.mappings || []).length - filteredMappings.length;
  if (!skipAppfilter) {
    const appFilter = buildAppFilter(filteredMappings);
    writeFile(path.join(xmlDir, 'appfilter.xml'), appFilter);
    writeFile(path.join(assetsDir, 'appfilter.xml'), appFilter);
  }

  const modeParts = [];
  if (onlyNew) modeParts.push('only-new');
  if (skipAppfilter) modeParts.push('skip-appfilter');
  const mode = modeParts.length ? modeParts.join('+') : 'full';
  console.log(
    `Generated icon pack resources from ${path.relative(root, configPath)} (mappings=${filteredMappings.length}, skipped=${skippedMappings}, mode=${mode})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
