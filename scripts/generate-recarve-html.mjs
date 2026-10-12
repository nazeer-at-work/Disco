#!/usr/bin/env node
/**
 * Generates an interactive Recarve & Delete review HTML file for Disco.
 * Allows comparing carved transparent icons with raw candidates, marking
 * icons for re-carving or deletion, and applying changes directly or via CLI.
 *
 * Usage:
 *   node scripts/generate-recarve-html.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'assets', 'icons-src');
const rawDir = path.join(root, 'assets', 'icons-raw');
const outputPath = path.join(root, 'recarve_review.html');

const masterPaths = [
  path.join(root, '../.agents/master-catalog/arcticons_master_3000.json'),
  path.join(root, '../icon-pack/master_data/arcticons_master_3000.json'),
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons_master_3000.json',
];
const masterPath = masterPaths.find((p) => fs.existsSync(p));
const masterMap = new Map();
if (masterPath) {
  try {
    const rawMaster = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    const apps = Array.isArray(rawMaster) ? rawMaster : (rawMaster.apps || []);
    apps.forEach((a) => {
      if (a.slug) masterMap.set(a.slug, a);
    });
  } catch (e) {}
}

const NON_ICON = new Set([
  'ic_disco_back',
  'ic_disco_mask',
  'ic_disco_upon',
  'ic_disco_back_1',
  'iconback',
  'iconmask',
  'iconupon',
]);

export function buildHtmlContent(isServerMode = false) {
  const srcFiles = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith('.webp') && !NON_ICON.has(f.replace(/\.webp$/, '')))
    .sort();
  const rawSet = new Set(
    fs.existsSync(rawDir)
      ? fs.readdirSync(rawDir).filter((f) => f.endsWith('.webp'))
      : []
  );

  const icons = srcFiles.map((file) => {
    const slug = file.replace(/\.webp$/, '');
    const hasRaw = rawSet.has(file);
    const meta = masterMap.get(slug);
    const name = meta ? meta.name : slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const rank = meta && meta.rank ? meta.rank : 99999;
    return {
      file,
      slug,
      name,
      rank,
      hasRaw,
      srcPath: `assets/icons-src/${file}`,
      rawPath: hasRaw ? `assets/icons-raw/${file}` : null,
    };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🪩 Disco Icon Pack — Recarve & Delete Review (${icons.length} Icons)</title>
  <style>
    :root {
      --bg: #090d16;
      --surface: #131b2e;
      --surface-border: #1e293b;
      --surface-hover: #1c2742;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent-recarve: #f59e0b;
      --accent-recarve-bg: rgba(245, 158, 11, 0.15);
      --accent-recarve-border: rgba(245, 158, 11, 0.5);
      --accent-delete: #f43f5e;
      --accent-delete-bg: rgba(244, 63, 94, 0.15);
      --accent-delete-border: rgba(244, 63, 94, 0.5);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding-bottom: 140px;
    }

    /* Sticky Header */
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(9, 13, 22, 0.92);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--surface-border);
      padding: 16px 28px;
    }

    .header-inner {
      max-width: 1720px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .title-area h1 {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title-area p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 3px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-wrap {
      position: relative;
    }

    .search-wrap input {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: #fff;
      padding: 9px 14px 9px 38px;
      border-radius: 10px;
      font-size: 0.88rem;
      width: 280px;
      outline: none;
      transition: all 0.2s;
    }

    .search-wrap input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .search-wrap svg {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      fill: var(--text-muted);
    }

    .filter-tabs {
      display: flex;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 10px;
      padding: 3px;
      gap: 2px;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 7px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .tab-btn.active {
      background: #1e293b;
      color: #fff;
    }

    .tab-btn.tab-recarve.active {
      background: var(--accent-recarve);
      color: #000;
    }

    .tab-btn.tab-delete.active {
      background: var(--accent-delete);
      color: #fff;
    }

    .btn {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 9px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .btn:hover {
      background: var(--surface-hover);
      border-color: #334155;
    }

    .btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
    }

    /* Main Grid */
    main {
      max-width: 1720px;
      margin: 24px auto;
      padding: 0 28px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 16px;
    }

    .card {
      background: var(--surface);
      border: 2px solid var(--surface-border);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
      user-select: none;
    }

    .card:hover {
      transform: translateY(-2px);
      border-color: #334155;
      box-shadow: 0 8px 16px -4px rgba(0,0,0,0.4);
    }

    .card.state-recarve {
      border-color: var(--accent-recarve);
      background: var(--accent-recarve-bg);
      box-shadow: 0 0 16px -2px rgba(245, 158, 11, 0.3);
    }

    .card.state-delete {
      border-color: var(--accent-delete);
      background: var(--accent-delete-bg);
      box-shadow: 0 0 16px -2px rgba(244, 63, 94, 0.3);
    }

    /* Comparison Area */
    .preview-box {
      width: 100%;
      height: 140px;
      border-radius: 10px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 14px 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .preview-box img.img-cutout {
      width: 110px;
      height: 110px;
      object-fit: contain;
      z-index: 2;
      transition: opacity 0.2s;
    }

    .preview-box img.img-raw {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      z-index: 1;
      opacity: 0;
      transition: opacity 0.2s;
      background: #000;
    }

    .card:hover .preview-box.compare-on-hover img.img-raw {
      opacity: 0.95;
      z-index: 3;
    }

    .hover-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      z-index: 4;
      background: rgba(0, 0, 0, 0.7);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      color: #94a3b8;
      pointer-events: none;
    }

    .card:hover .hover-badge {
      color: var(--accent-recarve);
      background: rgba(0, 0, 0, 0.9);
    }

    .meta-area {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .meta-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-slug {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Action Buttons on Card */
    .card-actions {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .action-btn {
      border: 1px solid var(--surface-border);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-muted);
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .btn-recarve.active {
      background: var(--accent-recarve);
      border-color: var(--accent-recarve);
      color: #000;
    }

    .btn-delete.active {
      background: var(--accent-delete);
      border-color: var(--accent-delete);
      color: #fff;
    }

    /* Fixed Bottom Action Dock */
    .dock-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      background: rgba(19, 27, 46, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.2);
      border-radius: 18px;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 95vw;
    }

    .dock-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .badge-recarve {
      background: var(--accent-recarve-bg);
      color: var(--accent-recarve);
      border: 1px solid var(--accent-recarve-border);
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .badge-delete {
      background: var(--accent-delete-bg);
      color: var(--accent-delete);
      border: 1px solid var(--accent-delete-border);
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .dock-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Modal */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 300;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-backdrop.open { display: flex; }

    .modal-box {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      max-width: 620px;
      width: 100%;
      padding: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-body {
      margin: 16px 0;
      font-size: 0.92rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .code-box {
      background: #090d16;
      border: 1px solid var(--surface-border);
      padding: 12px;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.82rem;
      color: #38bdf8;
      overflow-x: auto;
      margin: 12px 0;
      word-break: break-all;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .toast {
      position: fixed;
      top: 80px;
      right: 28px;
      background: #10b981;
      color: #000;
      font-weight: 800;
      padding: 12px 20px;
      border-radius: 10px;
      z-index: 400;
      opacity: 0;
      transform: translateY(-8px);
      transition: all 0.25s;
      pointer-events: none;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4);
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>

  <header>
    <div class="header-inner">
      <div class="title-area">
        <h1>🪩 Disco Icon Pack — Recarve & Delete Review</h1>
        <p>Hover card to inspect raw candidate • Toggle <strong>Recarve</strong> or <strong>Delete</strong> • Auto-stages 100 files per carve batch</p>
      </div>

      <div class="toolbar">
        <div class="search-wrap">
          <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" id="searchInput" placeholder="Search icon slug or app name..." oninput="filterIcons()">
        </div>

        <div class="filter-tabs">
          <button class="tab-btn active" id="tabAll" onclick="setFilter('all')">All (<span id="countAll">${icons.length}</span>)</button>
          <button class="tab-btn tab-recarve" id="tabRecarve" onclick="setFilter('recarve')">🔄 To Recarve (<span id="countRecarve">0</span>)</button>
          <button class="tab-btn tab-delete" id="tabDelete" onclick="setFilter('delete')">🗑️ To Delete (<span id="countDelete">0</span>)</button>
        </div>

        <button class="btn" onclick="clearAllMarks()">Clear Marks</button>
      </div>
    </div>
  </header>

  <main>
    <div class="grid" id="iconsGrid">
      ${icons
        .map(
          (icon) => `
        <div class="card" id="card-${icon.slug}" data-slug="${icon.slug}" data-name="${icon.name}">
          <div class="preview-box compare-on-hover">
            <span class="hover-badge">${icon.hasRaw ? 'Hover for Raw' : 'No Raw'}</span>
            <img class="img-cutout" src="${icon.srcPath}" alt="${icon.slug}" loading="lazy">
            ${
              icon.hasRaw
                ? `<img class="img-raw" src="${icon.rawPath}" alt="${icon.slug} raw" loading="lazy">`
                : ''
            }
          </div>
          <div class="meta-area">
            <span class="meta-title" title="${icon.name}">${icon.name}</span>
            <span class="meta-slug" title="${icon.slug}">${icon.slug}</span>
          </div>
          <div class="card-actions">
            <button class="action-btn btn-recarve" id="btn-recarve-${icon.slug}" onclick="toggleRecarve('${icon.slug}')">
              🔄 Recarve
            </button>
            <button class="action-btn btn-delete" id="btn-delete-${icon.slug}" onclick="toggleDelete('${icon.slug}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </main>

  <!-- Fixed Bottom Dock -->
  <div class="dock-container">
    <div class="dock-summary">
      <span class="badge-recarve" id="dockRecarveBadge">0 for Recarve</span>
      <span class="badge-delete" id="dockDeleteBadge">0 for Delete</span>
    </div>

    <div class="dock-actions">
      <button class="btn btn-primary" onclick="handleExecute()">⚡ Apply Changes</button>
      <button class="btn" onclick="exportJSON()">💾 Export JSON</button>
      <button class="btn" onclick="copyCliCommand()">📋 Copy CLI</button>
    </div>
  </div>

  <!-- Modal for Confirmation / Execution Feedback -->
  <div class="modal-backdrop" id="execModal">
    <div class="modal-box">
      <h2 class="modal-title" id="modalTitle">⚡ Execute Batch Actions</h2>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer" id="modalFooter">
        <button class="btn" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">Copied to clipboard!</div>

  <script>
    const isServer = ${isServerMode ? 'true' : 'window.location.protocol.startsWith("http")'};
    const recarveSet = new Set();
    const deleteSet = new Set();
    let currentFilter = 'all';

    function toggleRecarve(slug) {
      deleteSet.delete(slug); // Cannot be both
      if (recarveSet.has(slug)) {
        recarveSet.delete(slug);
      } else {
        recarveSet.add(slug);
      }
      syncCard(slug);
    }

    function toggleDelete(slug) {
      recarveSet.delete(slug); // Cannot be both
      if (deleteSet.has(slug)) {
        deleteSet.delete(slug);
      } else {
        deleteSet.add(slug);
      }
      syncCard(slug);
    }

    function syncCard(slug) {
      const card = document.getElementById('card-' + slug);
      const btnRecarve = document.getElementById('btn-recarve-' + slug);
      const btnDelete = document.getElementById('btn-delete-' + slug);

      card.classList.remove('state-recarve', 'state-delete');
      btnRecarve.classList.remove('active');
      btnDelete.classList.remove('active');

      if (recarveSet.has(slug)) {
        card.classList.add('state-recarve');
        btnRecarve.classList.add('active');
      } else if (deleteSet.has(slug)) {
        card.classList.add('state-delete');
        btnDelete.classList.add('active');
      }

      updateBadges();
      if (currentFilter !== 'all') {
        filterIcons();
      }
    }

    function updateBadges() {
      const r = recarveSet.size;
      const d = deleteSet.size;

      document.getElementById('countRecarve').innerText = r;
      document.getElementById('countDelete').innerText = d;
      document.getElementById('dockRecarveBadge').innerText = r + ' for Recarve';
      document.getElementById('dockDeleteBadge').innerText = d + ' for Delete';
    }

    function clearAllMarks() {
      const allAffected = new Set([...recarveSet, ...deleteSet]);
      recarveSet.clear();
      deleteSet.clear();
      allAffected.forEach(syncCard);
    }

    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      if (filter === 'all') document.getElementById('tabAll').classList.add('active');
      if (filter === 'recarve') document.getElementById('tabRecarve').classList.add('active');
      if (filter === 'delete') document.getElementById('tabDelete').classList.add('active');
      filterIcons();
    }

    function filterIcons() {
      const query = document.getElementById('searchInput').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.card');

      cards.forEach(card => {
        const slug = card.getAttribute('data-slug');
        const name = card.getAttribute('data-name').toLowerCase();
        const matchesQuery = !query || slug.includes(query) || name.includes(query);

        let matchesTab = true;
        if (currentFilter === 'recarve') matchesTab = recarveSet.has(slug);
        if (currentFilter === 'delete') matchesTab = deleteSet.has(slug);

        if (matchesQuery && matchesTab) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function exportJSON() {
      if (recarveSet.size === 0 && deleteSet.size === 0) {
        return alert('Please mark at least one icon for recarve or delete first.');
      }
      const data = {
        createdAt: new Date().toISOString(),
        recarve: Array.from(recarveSet),
        delete: Array.from(deleteSet)
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", "recarve_actions.json");
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Exported recarve_actions.json!');
    }

    function copyCliCommand() {
      if (recarveSet.size === 0 && deleteSet.size === 0) {
        return alert('Please mark at least one icon for recarve or delete first.');
      }
      let cmd = 'node scripts/apply-recarve.mjs';
      if (recarveSet.size > 0) cmd += ' --recarve "' + Array.from(recarveSet).join(',') + '"';
      if (deleteSet.size > 0) cmd += ' --delete "' + Array.from(deleteSet).join(',') + '"';
      navigator.clipboard.writeText(cmd);
      showToast('Copied CLI command to clipboard!');
    }

    async function handleExecute() {
      if (recarveSet.size === 0 && deleteSet.size === 0) {
        return alert('Please mark at least one icon for recarve or delete first.');
      }

      if (isServer) {
        // Run live API call to localhost server
        openModal('⏳ Processing Changes...', '<p>Staging recarve batches (100 files per folder) and syncing icon pack...</p>');
        try {
          const res = await fetch('/api/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recarve: Array.from(recarveSet),
              delete: Array.from(deleteSet)
            })
          });
          const result = await res.json();
          if (result.success) {
            let msg = '<p><strong>🎉 Successfully applied actions!</strong></p>';
            if (result.recarveBatches && result.recarveBatches.length > 0) {
              msg += '<p style="margin-top:10px;">📦 <strong>Recarve Folders Staged:</strong></p><ul>';
              result.recarveBatches.forEach(b => {
                msg += '<li>assets/carve/' + b + '</li>';
              });
              msg += '</ul>';
            }
            if (result.deletedCount > 0) {
              msg += '<p style="margin-top:10px;">🗑️ Deleted ' + result.deletedCount + ' icons from pack.</p>';
            }
            msg += '<p style="margin-top:10px; color:#38bdf8;">🔄 Pack manifests and appfilter synchronized.</p>';

            // Remove processed cards from view
            [...recarveSet, ...deleteSet].forEach(slug => {
              const el = document.getElementById('card-' + slug);
              if (el) el.remove();
            });
            recarveSet.clear();
            deleteSet.clear();
            updateBadges();

            openModal('✅ Actions Applied Successfully', msg);
          } else {
            openModal('❌ Error', '<p>' + (result.error || 'Unknown error occurred') + '</p>');
          }
        } catch (e) {
          openModal('⚠️ Server Unreachable', '<p>Could not connect to local server. Use the CLI command below:</p><div class="code-box">node scripts/apply-recarve.mjs --recarve "' + Array.from(recarveSet).join(',') + '"</div>');
        }
      } else {
        // Static mode
        const cmd = 'node scripts/apply-recarve.mjs --recarve "' + Array.from(recarveSet).join(',') + '"' + (deleteSet.size ? ' --delete "' + Array.from(deleteSet).join(',') + '"' : '');
        let body = '<p>You marked <strong>' + recarveSet.size + '</strong> icons for recarve and <strong>' + deleteSet.size + '</strong> for delete.</p>';
        body += '<p style="margin-top:8px;">Run this command in terminal to stage the 100-per-folder batches in <code>assets/carve/</code> and delete marked icons:</p>';
        body += '<div class="code-box">' + cmd + '</div>';
        body += '<p>Or start the review server with <code>npm run review:recarve</code> for 1-click execution inside the browser!</p>';
        openModal('⚡ Run Command in Terminal', body, '<button class="btn btn-primary" onclick="copyCliCommand(); closeModal();">📋 Copy Command</button><button class="btn" onclick="exportJSON()">💾 Export JSON</button>');
      }
    }

    function openModal(title, body, customFooter) {
      document.getElementById('modalTitle').innerHTML = title;
      document.getElementById('modalBody').innerHTML = body;
      if (customFooter) {
        document.getElementById('modalFooter').innerHTML = customFooter + '<button class="btn" onclick="closeModal()">Close</button>';
      } else {
        document.getElementById('modalFooter').innerHTML = '<button class="btn" onclick="closeModal()">Close</button>';
      }
      document.getElementById('execModal').classList.add('open');
    }

    function closeModal() {
      document.getElementById('execModal').classList.remove('open');
    }
  </script>
</body>
</html>`;
}

async function main() {
  console.log('Generating Disco Recarve Review HTML...');
  const html = buildHtmlContent(false);
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`✅ Generated: ${outputPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(console.error);
}
