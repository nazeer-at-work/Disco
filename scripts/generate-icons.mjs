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

// Load .env (KEY=VALUE lines) into process.env for any keys not already set, so
// GEMINI_API_KEY can live in .env instead of being exported in the shell.
(function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fsSync.existsSync(envPath)) return;
  for (const line of fsSync.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
})();

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';
const appsPath = path.join(root, 'config', 'icons.json');
const promptPath = path.join(root, 'config', 'icon-prompt.md');
const systemPromptPath = path.join(root, 'config', 'system-icon-prompt.md');
const locksPath = path.join(root, 'config', 'brand-locks.json');
const refDir = path.join(root, 'assets', 'logo-refs');
const rawDir = path.join(root, 'assets', 'icons-raw'); // pristine model output (white bg) — preserved
const outDir = path.join(root, 'assets', 'icons-src'); // transparent versions consumed by build

function parseArgs(argv) {
  const args = { names: undefined, model: DEFAULT_MODEL, overwrite: false, limit: undefined, dryRun: false, maxRetries: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--names') args.names = argv[++i];
    else if (v === '--model') args.model = argv[++i];
    else if (v === '--overwrite') args.overwrite = true;
    else if (v === '--limit') args.limit = Number(argv[++i]);
    else if (v === '--max-retries') args.maxRetries = Number(argv[++i]);
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

// Strip the editor-only comment above the first standalone "---" marker.
function stripPromptComment(raw) {
  const markerIdx = raw.search(/^---\s*$/m);
  return (markerIdx === -1
    ? raw
    : raw.slice(markerIdx + raw.slice(markerIdx).indexOf('\n') + 1)).trim();
}

// Text-only prompt for generic/system icons (no brand logo to convert): fill the
// {{subject}} placeholder in config/system-icon-prompt.md with the app's symbol.
function buildSystemPrompt(template, subject) {
  return template.replace(/\{\{\s*subject\s*\}\}/g, subject);
}

function findReference(slug) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(refDir, `${slug}.${ext}`);
    if (fsSync.existsSync(p)) return p;
  }
  return null;
}

// Resolve the app's official store-icon URL: Google Play first (Android icons,
// no API key), then iTunes/App Store as fallback.
async function resolveIconUrl(app) {
  // Google Play via google-play-scraper (optional dep — fall back if absent).
  try {
    const mod = await import('google-play-scraper');
    const gplay = mod.default || mod;
    const results = await gplay.search({ term: app.name, num: 1 });
    const icon = results?.[0]?.icon;
    if (icon) return { url: icon.split('=')[0] + '=s512', source: 'play' };
  } catch {
    // package missing or lookup failed -> fall through to iTunes
  }
  // iTunes / App Store fallback.
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(app.name)}&entity=software&limit=1`,
    );
    if (res.ok) {
      const data = await res.json();
      const art = data?.results?.[0]?.artworkUrl512 || data?.results?.[0]?.artworkUrl100;
      if (art) return { url: art.replace(/\/\d+x\d+bb\.(png|jpg|jpeg)$/i, '/512x512bb.$1'), source: 'itunes' };
    }
  } catch {
    // ignore
  }
  return null;
}

// Fetch the app's official store icon (real logo + brand colors) as the
// generation reference, so styling preserves the actual mark/colors.
// Cached to assets/logo-refs/<slug>.png; a manually-placed file always wins.
async function fetchOfficialIcon(app) {
  const local = findReference(app.slug);
  if (local) return { path: local, source: 'local' };
  const resolved = await resolveIconUrl(app);
  if (!resolved) return null;
  try {
    const img = await fetch(resolved.url);
    if (!img.ok) return null;
    await fs.mkdir(refDir, { recursive: true });
    const out = path.join(refDir, `${app.slug}.png`);
    await sharp(Buffer.from(await img.arrayBuffer())).png().toFile(out);
    return { path: out, source: resolved.source };
  } catch {
    return null;
  }
}

function extractImage(payload) {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      const inline = part?.inlineData || part?.inline_data;
      const mime = String(inline?.mimeType || inline?.mime_type || '').toLowerCase();
      if (inline?.data && mime.startsWith('image/')) {
        return Buffer.from(inline.data, 'base64');
      }
    }
  }
  return null;
}

function buildParts(prompt, referenceBuffer) {
  const parts = [];
  if (referenceBuffer) {
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceBuffer.toString('base64') } });
  }
  parts.push({ text: prompt });
  return parts;
}

// Mint a Vertex access token. Priority: explicit env token, else Application
// Default Credentials via google-auth-library — which resolves, in order,
// GOOGLE_APPLICATION_CREDENTIALS, `gcloud auth application-default login` (ADC),
// or a GCE/Cloud metadata server. No service-account key file required.
async function getVertexToken() {
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN;
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    const token = typeof t === 'string' ? t : t?.token;
    if (token) return token;
  } catch (err) {
    throw new Error(
      `Vertex auth failed (${err.message}). Run \`gcloud auth application-default login\`, or set VERTEX_ACCESS_TOKEN.`,
    );
  }
  throw new Error('Vertex auth: no credentials. Run `gcloud auth application-default login` or set VERTEX_ACCESS_TOKEN.');
}

// Same gemini-*-flash-image model, routed through Vertex AI (GCP billing).
// Abort a request that hangs (Vertex's shared endpoint sometimes stalls for many
// minutes). On timeout the fetch rejects -> the caller's retry loop re-issues it,
// instead of the whole run blocking forever on one stuck call.
const REQUEST_TIMEOUT_MS = Number(process.env.GEN_TIMEOUT_MS || 90000);
async function fetchWithTimeout(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generateImageVertex({ project, location, model, prompt, referenceBuffer }) {
  const token = await getVertexToken();
  // The global endpoint uses a bare host (no region prefix).
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: buildParts(prompt, referenceBuffer) }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`Vertex image API failed (${res.status}): ${await res.text()}`);
  const img = extractImage(await res.json());
  if (!img) throw new Error('Vertex returned no image data');
  return img;
}

// AI Studio (Generative Language API) via API key.
async function generateImageAiStudio({ apiKey, model, prompt, referenceBuffer }) {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: buildParts(prompt, referenceBuffer) }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini image API failed (${res.status}): ${await res.text()}`);
  const img = extractImage(await res.json());
  if (!img) throw new Error('Gemini returned no image data');
  return img;
}

async function generateImage({ backend, apiKey, model, prompt, referenceBuffer }) {
  if (backend.type === 'vertex') {
    return generateImageVertex({ ...backend, model: backend.model, prompt, referenceBuffer });
  }
  return generateImageAiStudio({ apiKey, model, prompt, referenceBuffer });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fsSync.existsSync(promptPath)) {
    throw new Error(`Missing prompt template: ${promptPath}`);
  }
  const template = stripPromptComment(await fs.readFile(promptPath, 'utf8'));
  // Optional text-only template for generic/system icons (apps with a `subject`).
  const systemTemplate = fsSync.existsSync(systemPromptPath)
    ? stripPromptComment(await fs.readFile(systemPromptPath, 'utf8'))
    : null;
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

  // Backend: Vertex AI (GCP billing) if VERTEX_PROJECT is set, else AI Studio key.
  const apiKey = process.env.GEMINI_API_KEY;
  const backend = process.env.VERTEX_PROJECT
    ? {
        type: 'vertex',
        project: process.env.VERTEX_PROJECT,
        location: process.env.VERTEX_LOCATION || 'us-central1',
        model: process.env.VERTEX_MODEL || 'gemini-2.5-flash-image',
      }
    : { type: 'aistudio' };
  if (!args.dryRun) {
    if (backend.type === 'aistudio' && !apiKey) {
      throw new Error('GEMINI_API_KEY is required (or set VERTEX_PROJECT for Vertex, or --dry-run).');
    }
    console.log(
      backend.type === 'vertex'
        ? `[generate-icons] backend: Vertex AI (project ${backend.project}, ${backend.location}, ${backend.model})`
        : `[generate-icons] backend: AI Studio (${args.model})`,
    );
  }

  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });
  let made = 0;
  let skipped = 0;
  const failed = [];

  for (const app of apps) {
    const rawTarget = path.join(rawDir, `${app.slug}.webp`);
    // Skip if we already have the pristine original (re-deriving transparency is free).
    if (!args.overwrite && fsSync.existsSync(rawTarget)) {
      skipped += 1;
      continue;
    }
    // Generic/system icons: a `subject` (text-only, no logo) takes a dedicated
    // template and never fetches a brand reference (which would be wrong anyway).
    const isSystem = Boolean(app.subject) || app.noRef === true;
    let prompt;
    if (app.prompt && app.prompt.trim()) {
      prompt = app.prompt.trim();
    } else if (app.subject) {
      if (!systemTemplate) throw new Error(`config/system-icon-prompt.md missing (needed for "${app.name}")`);
      prompt = buildSystemPrompt(systemTemplate, app.subject.trim());
    } else {
      prompt = buildPrompt(template, app.name, locks[app.slug]);
    }

    if (args.dryRun) {
      console.log(`\n=== ${app.name} (${app.slug}) ===\n${prompt}`);
      continue;
    }

    try {
      const ref = isSystem ? null : await fetchOfficialIcon(app);
      const referenceBuffer = ref
        ? await sharp(await fs.readFile(ref.path)).resize(512, 512, { fit: 'inside' }).png().toBuffer()
        : null;
      // Two distinct failure modes:
      //  - 429 RESOURCE_EXHAUSTED: rate/quota — wait and retry WITHOUT spending a
      //    real attempt (global endpoint is throttled to a few req/min).
      //  - other (occasional refusal/empty): spend a real attempt, short backoff.
      let raw = null;
      let lastErr = null;
      let realAttempts = 0;
      let quotaWaits = 0;
      while (realAttempts < Math.max(1, args.maxRetries) && quotaWaits < 30) {
        try {
          raw = await generateImage({ backend, apiKey, model: args.model, prompt, referenceBuffer });
          break;
        } catch (e) {
          lastErr = e;
          if (/\b429\b|RESOURCE_EXHAUSTED/.test(e.message)) {
            quotaWaits += 1;
            process.stdout.write(`  ${app.name}: 429 quota — waiting 35s (${quotaWaits})\n`);
            await new Promise(r => setTimeout(r, 35000));
          } else {
            realAttempts += 1;
            if (realAttempts >= args.maxRetries) break;
            process.stdout.write(`  retry ${app.name} (${realAttempts}/${args.maxRetries})\n`);
            await new Promise(r => setTimeout(r, 4000));
          }
        }
      }
      if (!raw) throw lastErr || new Error('no image after retries');
      // Preserve the pristine model output (white bg) — irreplaceable source.
      // Transparency is done in a separate, batched step: `npm run remove-bg`
      // (rembg, one model load) reads icons-raw -> icons-src before build.
      await sharp(raw).trim().webp({ quality: 92, effort: 6 }).toFile(rawTarget);
      made += 1;
      console.log(`[generate-icons] ${app.name} -> raw${ref ? ` (ref: ${ref.source})` : ' (NO ref — text only)'}`);
    } catch (err) {
      failed.push(app.name);
      console.error(`[generate-icons] FAILED ${app.name}: ${err.message}`);
    }
  }

  console.log(`\n[generate-icons] done — ${made} generated, ${skipped} skipped (exists)${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}.`);
  if (made > 0) console.log('[generate-icons] Next: npm run remove-bg (transparent), then npm run build:icon-pack.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
