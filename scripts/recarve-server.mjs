#!/usr/bin/env node
/**
 * Interactive Local Review Server for Disco Recarve & Delete actions.
 * Allows 1-click execution in the browser to stage recarve batches (100 per folder)
 * and clean the pack.
 *
 * Usage:
 *   node scripts/recarve-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { buildHtmlContent } from './generate-recarve-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'assets', 'icons-raw');
const srcDir = path.join(root, 'assets', 'icons-src');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
const carveDir = path.join(root, 'assets', 'carve');
const manifestPath = path.join(carveDir, 'carve_batches_manifest.json');
const PORT = 3344;
const BATCH_SIZE = 100;

function handleStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/' || urlPath === '/index.html') {
    const html = buildHtmlContent(true);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return true;
  }

  if (urlPath.startsWith('/assets/')) {
    const filePath = path.join(root, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(filePath).pipe(res);
      return true;
    }
  }

  return false;
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/apply') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const recarveSlugs = Array.from(new Set(payload.recarve || []));
        const deleteSlugs = Array.from(new Set(payload.delete || []));

        console.log(`\n======================================================`);
        console.log(`🪩  RECEIVED ACTIONS FROM BROWSER`);
        console.log(`======================================================`);
        console.log(`🔄 Recarve: ${recarveSlugs.length} icons`);
        console.log(`🗑️ Delete:  ${deleteSlugs.length} icons`);

        // 1. Process Deletions
        let deletedCount = 0;
        for (const slug of deleteSlugs) {
          const srcFile = path.join(srcDir, `${slug}.webp`);
          const resFile = path.join(resDir, `${slug}.webp`);
          if (fs.existsSync(srcFile)) {
            fs.unlinkSync(srcFile);
            deletedCount++;
          }
          if (fs.existsSync(resFile)) fs.unlinkSync(resFile);
        }

        // 2. Process Recarve
        let recarveBatches = [];
        if (recarveSlugs.length > 0) {
          const validRecarve = [];
          for (const slug of recarveSlugs) {
            const rawFile = path.join(rawDir, `${slug}.webp`);
            if (fs.existsSync(rawFile)) {
              validRecarve.push(slug);
            }
          }

          // Remove old cutouts from src & res so they will be replaced upon new carve
          for (const slug of validRecarve) {
            const srcFile = path.join(srcDir, `${slug}.webp`);
            const resFile = path.join(resDir, `${slug}.webp`);
            if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile);
            if (fs.existsSync(resFile)) fs.unlinkSync(resFile);
          }

          const totalBatches = Math.ceil(validRecarve.length / BATCH_SIZE);
          let manifest = { batches: {} };
          if (fs.existsSync(manifestPath)) {
            try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {}
          }

          for (let b = 0; b < totalBatches; b++) {
            const batchName = totalBatches === 1 ? 'batch-recarve' : `batch-recarve-${String(b + 1).padStart(2, '0')}`;
            const batchFolder = path.join(carveDir, batchName);
            fs.mkdirSync(batchFolder, { recursive: true });

            const slice = validRecarve.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
            for (const slug of slice) {
              fs.copyFileSync(path.join(rawDir, `${slug}.webp`), path.join(batchFolder, `${slug}.webp`));
            }

            manifest.batches[batchName] = {
              count: slice.length,
              isRecarve: true,
              files: slice.map((s) => `${s}.webp`),
              stagedAt: new Date().toISOString(),
            };
            recarveBatches.push(batchName);
          }
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        }

        // 3. Sync Pack
        execSync('node scripts/sync-pack.mjs', { cwd: root, stdio: 'inherit' });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          recarveCount: recarveSlugs.length,
          recarveBatches,
          deletedCount,
        }));
      } catch (err) {
        console.error('Error applying actions:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (handleStatic(req, res)) return;

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🪩  DISCO RECARVE & DELETE SERVER RUNNING`);
  console.log(`======================================================`);
  console.log(`🌐 Open in browser:  http://localhost:${PORT}`);
  console.log(`📂 HTML Source:      recarve_review.html`);
  console.log(`📦 Carve Batches:    assets/carve/`);
  console.log(`======================================================\n`);
});
