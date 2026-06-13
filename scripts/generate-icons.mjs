#!/usr/bin/env node
/**
 * Generate icon-pack source images with Google Gemini's image model and write them
 * to assets/icons-src/<slug>.webp (transparent RGBA — no background-removal step).
 *
 * The prompt is NOT hard-coded: it is read from config/icon-prompt.md so each pack
 * can define its own art style by editing that one file. Prompt resolution order:
 *   1. per-app `prompt` in config/icons.json (full override)
 *   2. config/icon-prompt.md template with {{appName}} / {{brandLock}} filled in,
 *      where {{brandLock}} comes from config/brand-locks.json[slug].
 *
 * Requires GEMINI_API_KEY. Optionally drop a reference logo at
 * assets/logo-refs/<slug>.(png|jpg|webp|svg) to improve brand fidelity.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/generate-icons.mjs            # all of config/icons.json
 *   GEMINI_API_KEY=... node scripts/generate-icons.mjs --names "YouTube,Spotify"
 *   node scripts/generate-icons.mjs --dry-run                      # print prompts only
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';
const appsPath = path.join(root, 'config', 'icons.json');
const promptPath = path.join(root, 'config', 'icon-prompt.md');
const locksPath = path.join(root, 'config', 'brand-locks.json');
const refDir = path.join(root, 'assets', 'logo-refs');
const outDir = path.join(root, 'assets', 'icons-src');

function parseArgs(argv) {
  const args = { names: undefined, model: DEFAULT_MODEL, overwrite: false, limit: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--names') args.names = argv[++i];
    else if (v === '--model') args.model = argv[++i];
    else if (v === '--overwrite') args.overwrite = true;
    else if (v === '--limit') args.limit = Number(argv[++i]);
    else if (v === '--dry-run') args.dryRun = true;
  }
  return args;
}

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function readJson(file, fallback) {
  if (!fsSync.existsSync(file)) return fallback;
  return JSON.parse(fsSync.readFileSync(file, 'utf8'));
}

function buildPrompt(template, appName, brandLock) {
  const lock = brandLock?.trim()
    ? brandLock.trim()
    : 'exact official primary logo mark, exact geometry, exact brand color palette.';
  return template
    .replace(/\{\{\s*appName\s*\}\}/g, appName)
    .replace(/\{\{\s*brandLock\s*\}\}/g, lock);
}

function findReference(slug) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(refDir, `${slug}.${ext}`);
    if (fsSync.existsSync(p)) return p;
  }
  return null;
}

async function generateImage({ apiKey, model, prompt, referenceBuffer }) {
  const parts = [];
  if (referenceBuffer) {
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceBuffer.toString('base64') } });
  }
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini image API failed (${res.status}): ${await res.text()}`);
  }
  const payload = await res.json();
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      const inline = part?.inlineData || part?.inline_data;
      const mime = String(inline?.mimeType || inline?.mime_type || '').toLowerCase();
      if (inline?.data && mime.startsWith('image/')) {
        return Buffer.from(inline.data, 'base64');
      }
    }
  }
  throw new Error('Gemini returned no image data');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fsSync.existsSync(promptPath)) {
    throw new Error(`Missing prompt template: ${promptPath}`);
  }
  const rawTemplate = await fs.readFile(promptPath, 'utf8');
  // Everything before the first standalone "---" marker is an editor-only comment.
  const markerIdx = rawTemplate.search(/^---\s*$/m);
  const template = (markerIdx === -1 ? rawTemplate : rawTemplate.slice(markerIdx + rawTemplate.slice(markerIdx).indexOf('\n') + 1)).trim();
  const locks = readJson(locksPath, {});

  let apps;
  if (args.names) {
    apps = args.names.split(',').map(n => n.trim()).filter(Boolean).map(name => ({ name, slug: slugify(name) }));
  } else {
    const cfg = readJson(appsPath, { apps: [] });
    apps = (cfg.apps || []).map(a => ({ ...a, slug: a.slug || slugify(a.name) }));
  }
  if (args.limit) apps = apps.slice(0, args.limit);
  if (!apps.length) {
    console.log('[generate-icons] No apps to generate. Add entries to config/icons.json or pass --names.');
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !args.dryRun) {
    throw new Error('GEMINI_API_KEY is required (or pass --dry-run to preview prompts).');
  }

  await fs.mkdir(outDir, { recursive: true });
  let made = 0;
  let skipped = 0;
  const failed = [];

  for (const app of apps) {
    const target = path.join(outDir, `${app.slug}.webp`);
    if (!args.overwrite && fsSync.existsSync(target)) {
      skipped += 1;
      continue;
    }
    const prompt = (app.prompt && app.prompt.trim())
      ? app.prompt.trim()
      : buildPrompt(template, app.name, locks[app.slug]);

    if (args.dryRun) {
      console.log(`\n=== ${app.name} (${app.slug}) ===\n${prompt}`);
      continue;
    }

    try {
      const refPath = findReference(app.slug);
      const referenceBuffer = refPath
        ? await sharp(await fs.readFile(refPath)).resize(512, 512, { fit: 'inside' }).png().toBuffer()
        : null;
      const raw = await generateImage({ apiKey, model: args.model, prompt, referenceBuffer });
      // Normalize to trimmed, transparent RGBA webp master (build-icon-pack caps it later).
      await sharp(raw).trim().ensureAlpha().webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(target);
      made += 1;
      console.log(`[generate-icons] ${app.name} -> ${path.relative(root, target)}${refPath ? ' (with ref)' : ''}`);
    } catch (err) {
      failed.push(app.name);
      console.error(`[generate-icons] FAILED ${app.name}: ${err.message}`);
    }
  }

  console.log(`\n[generate-icons] done — ${made} generated, ${skipped} skipped (exists)${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}.`);
  if (made > 0) console.log('[generate-icons] Next: npm run build:icon-pack (caps size + refreshes drawables/gallery).');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
