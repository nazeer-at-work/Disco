/* Carve Batch — process multiple folders of images through carve.photos free flow.
 * Picks folders one-by-one (re-prompt until user cancels) so you can queue
 * several batch-NNN folders in one run. Processes N at a time (default 7);
 * after each N it clears carve's site storage and cookies IN PLACE for a fresh
 * free session and auto-resumes. Tracks actual Chrome downloads via
 * chrome.downloads API to guarantee images are verified on disk. */

const state = { running: false, panel: null, logEl: null, headerEl: null };
const keepAlive = { audio: null, ctx: null, timer: null };

// Generate ~1s of silence as a WAV blob URL (no external file needed).
function silentWavUrl() {
  const rate = 8000, n = rate; // 1 second
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

// Keep this tab from being throttled/frozen/discarded while running in the background.
function startKeepAlive() {
  try {
    if (!keepAlive.audio) {
      const a = document.createElement('audio');
      a.loop = true; a.src = silentWavUrl(); a.volume = 0.02;
      a.setAttribute('aria-hidden', 'true'); a.style.display = 'none';
      document.body.appendChild(a);
      keepAlive.audio = a;
    }
    keepAlive.audio.play().catch(() => {});
  } catch {}
  try {
    if (!keepAlive.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0008;
      osc.frequency.value = 20;
      osc.connect(gain); gain.connect(ctx.destination); osc.start();
      keepAlive.ctx = ctx;
    }
    keepAlive.ctx.resume().catch(() => {});
  } catch {}
  try {
    if (!keepAlive.timer) {
      keepAlive.timer = setInterval(() => {}, 500);
    }
  } catch {}
  try { chrome.runtime.sendMessage({ type: 'KEEP_AWAKE' }); } catch {}
}

function stopKeepAlive() {
  try { keepAlive.audio && keepAlive.audio.pause(); } catch {}
  try { keepAlive.ctx && keepAlive.ctx.suspend(); } catch {}
  try { if (keepAlive.timer) { clearInterval(keepAlive.timer); keepAlive.timer = null; } } catch {}
  try { chrome.runtime.sendMessage({ type: 'RELEASE_AWAKE' }); } catch {}
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type !== 'START_BATCH') return;
  if (state.running) { sendResponse({ ok: false, error: 'Already running.' }); return; }
  const batchSize = msg.batchSize || 7;
  runBatch(batchSize)
    .then(() => sendResponse({ ok: true }))
    .catch(e => { logLine('Failed: ' + e.message); sendResponse({ ok: false, error: e.message }); });
  return true; // async
});

async function runBatch(batchSize) {
  if (!location.pathname.startsWith('/upload')) throw new Error('Open https://carve.photos/upload first.');
  state.running = true;
  ensurePanel();
  try {
    // ---- Single folder pick — user picks the PARENT folder (e.g. "carve") ----
    // The browser provides webkitRelativePath like "carve/batch-01/foo.webp".
    // We group all images by their immediate subfolder (depth-1 child), sorted
    // alphabetically so batch-01 runs before batch-02 etc.
    // If the user picks a leaf batch folder directly, all files land in one group.
    logLine('Pick the parent folder (e.g. "carve") — all batch sub-folders inside will be queued automatically.');

    const allPicked = await pickFolderFiles(); // one dialog, one pick
    startKeepAlive(); // folder pick was the user gesture

    // Group by immediate sub-folder (first path segment after the root)
    const groupMap = new Map(); // subfolder-key -> File[]
    for (const f of allPicked) {
      if (!/\.(webp|png|jpe?g)$/i.test(f.name)) continue;
      const parts = (f.webkitRelativePath || f.name).split('/');
      // If depth >= 3: parts = [root, subfolder, file] → key = subfolder
      // If depth == 2: parts = [root, file]             → key = root (direct files)
      const key = parts.length >= 3 ? parts[1] : parts[0];
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(f);
    }

    if (!groupMap.size) throw new Error('No images (webp/png/jpg) found in the selected folder.');

    // Sort groups alphabetically (batch-01 < batch-02 < ...)
    const allFolders = [...groupMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map(([name, files]) => ({ name, files: files.sort((a, b) => a.name.localeCompare(b.name)) }));

    const totalFiles = allFolders.reduce((s, f) => s + f.files.length, 0);
    setHeader(`Carve Batch · ${allFolders.length} folder(s) · ${totalFiles} images`);
    logLine(`▶ ${allFolders.length} folder(s): ${allFolders.map(f => f.name).join(', ')}`);
    logLine(`  ${totalFiles} total images · ${batchSize} per session`);

    // ---- Flat processing queue (session counter rolls across all folders) ----
    let prevSrc = resultBlobSrc();
    let consecutiveErrors = 0;
    let limitRetryCount = 0;
    let globalIndex = 0; // across all folders

    outerLoop: for (let fi = 0; fi < allFolders.length; fi++) {
      const folder = allFolders[fi];
      const folderLabel = `[${fi + 1}/${allFolders.length}] ${folder.name}`;
      logLine(`📁 ${folderLabel} — ${folder.files.length} images`);

      for (let i = 0; i < folder.files.length; i++) {
        const fileLabel = `[${i + 1}/${folder.files.length}]`;
        const label = `${folderLabel} ${fileLabel} ${folder.files[i].name}`;
        const slug = folder.files[i].name.replace(/\.[^.]+$/, '');
        const expectedName = `${slug}-no-bg-preview (carve.photos).png`;
        globalIndex++;

        try {
          logLine(`${label}: uploading...`);
          const input = await waitForFileInput(15000);
          await setInputFiles(input, [folder.files[i]]);
          await sleep(1000);

          logLine(`${label}: processing...`);
          const { src, btn } = await waitForResult(prevSrc, 180000);

          // 1. Arm download watcher in background
          const armRes = await chrome.runtime.sendMessage({
            type: 'ARM_DOWNLOAD_WATCH',
            baseName: slug,
            since: Date.now() - 500,
            timeoutMs: 12000,
          }).catch(() => null);

          // 2. Click the download button with authentic event sequence
          clickElement(btn);

          // 3. Wait for actual file download to complete
          let downloadRes = null;
          if (armRes?.watcherId) {
            downloadRes = await chrome.runtime.sendMessage({
              type: 'WAIT_FOR_DOWNLOAD',
              watcherId: armRes.watcherId,
            }).catch(() => null);
          }

          // 4. Fallback if download wasn't triggered by button click
          if (!downloadRes?.ok) {
            if (limitReached()) throw new Error('LIMIT_REACHED');

            logLine(`${label}: click didn't start download (${downloadRes?.error || 'timeout'}). Trying fallback...`);

            const armFallback = await chrome.runtime.sendMessage({
              type: 'ARM_DOWNLOAD_WATCH',
              baseName: slug,
              since: Date.now() - 500,
              timeoutMs: 15000,
            }).catch(() => null);

            triggerBlobDownload(src, expectedName);

            if (armFallback?.watcherId) {
              downloadRes = await chrome.runtime.sendMessage({
                type: 'WAIT_FOR_DOWNLOAD',
                watcherId: armFallback.watcherId,
              }).catch(() => null);
            }
          }

          // 5. Final verification
          if (!downloadRes?.ok) {
            if (limitReached()) throw new Error('LIMIT_REACHED');
            throw new Error(`NOT_DOWNLOADED: ${downloadRes?.error || 'verification failed'}`);
          }

          prevSrc = src;
          const finalName = downloadRes.filename ? downloadRes.filename.split(/[\/\\]/).pop() : expectedName;
          logLine(`${label}: ✅ downloaded (${finalName}).`);
          consecutiveErrors = 0;
          limitRetryCount = 0;
          await sleep(2000);
        } catch (err) {
          if (err.message === 'LIMIT_REACHED') {
            limitRetryCount++;
            if (limitRetryCount > 2) {
              logLine(`🛑 STOPPED: Free limit hit again after session clear. Carve likely has an IP/daily limit.`);
              break outerLoop;
            }
            logLine(`${label}: hit free limit — clearing session and retrying (attempt ${limitRetryCount}/2)...`);
            await clearViaBrowsingData();
            await clearCarveStorage();
            await sleep(3500);
            prevSrc = resultBlobSrc();
            i -= 1; // retry same image
            globalIndex--;
            continue;
          }

          consecutiveErrors++;
          logLine(`${label}: ❌ ERROR ${err.message}`);
          if (consecutiveErrors >= 3) {
            logLine(`🛑 STOPPED: 3 consecutive downloads failed.`);
            break outerLoop;
          }
        }

        // After every `batchSize` (rolling across all folders), reset free session.
        const atSessionEnd = globalIndex % batchSize === 0;
        const moreLeft = !(fi === allFolders.length - 1 && i === folder.files.length - 1);
        if (atSessionEnd && moreLeft) {
          logLine(`Session of ${batchSize} done. Clearing carve site data...`);
          const viaApi = await clearViaBrowsingData();
          await clearCarveStorage();
          logLine(viaApi ? 'Cleared via browsingData + cookies.' : 'In-page clear only.');
          await sleep(3000);
          prevSrc = resultBlobSrc();
        }
      }
    }

    logLine(`✅ ALL DONE — ${globalIndex} of ${totalFiles} images processed. Check your Downloads folder.`);
    setHeader('Carve Batch · DONE');
  } finally {
    state.running = false;
    stopKeepAlive();
  }
}

// Fallback trigger of transparent preview blob
function triggerBlobDownload(blobUrl, filename) {
  if (!blobUrl) return;
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'transparent.png';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { a.remove(); } catch {}
    }, 1000);
  } catch (e) {
    console.error('triggerBlobDownload error:', e);
  }
}

// DevTools-style "Clear site data" + cookies via background worker
async function clearViaBrowsingData() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'CLEAR_SITE_DATA' });
    return !!res?.ok;
  } catch {
    return false;
  }
}

// In-page clear (fallback / incognito)
async function clearCarveStorage() {
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
  } catch {}
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const d of dbs) if (d.name) indexedDB.deleteDatabase(d.name);
    }
  } catch {}
  try { if (window.caches) { const ks = await caches.keys(); for (const k of ks) await caches.delete(k); } } catch {}
  try {
    document.cookie.split(';').forEach(c => {
      const n = c.split('=')[0].trim();
      if (n) document.cookie = `${n}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch {}
}

// ---------- folder pick ----------
// Returns a Promise that resolves with the file list for ONE selected folder,
// or rejects if the user cancels (no files chosen).
function pickFolderFiles() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';

    // Cancelled: the 'change' event fires with an empty FileList,
    // or in some browsers a 'cancel' event fires instead.
    const onCancel = () => { input.remove(); reject(new Error('cancelled')); };
    input.addEventListener('cancel', onCancel);
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.remove();
      files.length ? resolve(files) : reject(new Error('cancelled'));
    });

    document.body.appendChild(input);
    input.click();
  });
}

// ---------- upload ----------
async function waitForFileInput(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const input =
      document.querySelector('input[type="file"]:not([webkitdirectory])') ||
      document.querySelector('input[type="file"]');
    if (input) return input;
    await sleep(250);
  }
  throw new Error('Upload input not found.');
}

async function setInputFiles(input, files) {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(300);
}

// ---------- download detection ----------
function isDisabled(el) {
  if (!el) return true;
  if (el.disabled === true) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  const style = getComputedStyle(el);
  if (style.pointerEvents === 'none' || style.display === 'none' || style.visibility === 'hidden') return true;
  return false;
}

// The exact free-download button: <button class="download-button-main">Download Free</button>
function freeDownloadBtn() {
  const allBtns = Array.from(document.querySelectorAll('button.download-button-main, button, a[download], [role="button"]'));
  return allBtns.find(b => {
    const text = (b.textContent || '').trim().toLowerCase();
    const isFree = /free|preview|бесплат/i.test(text) || b.classList.contains('download-button-main');
    const isPaid = /hd|pro|paid|оплат|купить|тари/i.test(text);
    return isFree && !isPaid;
  }) || null;
}

// The processed result is shown as a blob image; its src changes per image.
function resultBlobSrc() {
  const img =
    document.querySelector('img.rectangle135[src^="blob:"]') ||
    document.querySelector('.frame83 img[src^="blob:"]') ||
    document.querySelector('img[src^="blob:"]');
  return img ? img.src : '';
}

// Check for free limit modals, daily limit, or upgrade popups (English + Russian)
function limitReached() {
  const limitKeywords = [
    'free photos', 'limit reached', 'upgrade', 'daily-limit', 'no-credits',
    'guest-hd', 'credits-spent', 'лимит', 'исчерпан', 'оформить', 'подписк',
    'купить', 'тариф', 'дневной', 'закончились', 'free limit'
  ];

  // Check known modal containers
  const candidateModals = Array.from(document.querySelectorAll(
    '.popup-menu1, [role="dialog"], .modal, .dialog, .popup, [class*="limit"], [class*="pricing"], [class*="upgrade"]'
  ));

  for (const el of candidateModals) {
    const text = (el.textContent || '').toLowerCase();
    if (limitKeywords.some(kw => text.includes(kw))) {
      const style = getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        return true;
      }
    }
  }

  // Check generic overlays
  const overlays = Array.from(document.querySelectorAll('div[class*="overlay"], div[class*="popup"], div[class*="modal"]'));
  for (const el of overlays) {
    const text = (el.textContent || '').toLowerCase();
    if (limitKeywords.some(kw => text.includes(kw))) {
      const style = getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        return true;
      }
    }
  }

  return false;
}

// Wait until a NEW result blob is rendered and the free button is clickable.
async function waitForResult(prevSrc, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    if (limitReached()) throw new Error('LIMIT_REACHED');
    const src = resultBlobSrc();
    const btn = freeDownloadBtn();
    if (src && src !== prevSrc && btn && !isDisabled(btn)) return { src, btn };
    await sleep(600);
  }
  throw new Error('Timed out waiting for result.');
}

function clickElement(el) {
  if (!el) return;
  try { el.focus(); } catch {}
  const rect = el.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    buttons: 1
  };
  try { el.dispatchEvent(new PointerEvent('pointerdown', eventInit)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mousedown', eventInit)); } catch {}
  try { el.dispatchEvent(new PointerEvent('pointerup', eventInit)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mouseup', eventInit)); } catch {}
  try {
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', eventInit));
  } catch {}
}

// ---------- ui ----------
function ensurePanel() {
  if (state.panel) return;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;right:12px;bottom:12px;width:400px;max-height:52vh;overflow:auto;z-index:2147483647;background:#111;color:#f7f7f7;font:12px/1.4 monospace;padding:10px;border:1px solid #333;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  const t = document.createElement('div');
  t.textContent = 'Carve Batch · picking folders…';
  t.style.cssText = 'font-weight:700;margin-bottom:8px;color:#4ade80';
  const log = document.createElement('div');
  p.append(t, log);
  document.body.appendChild(p);
  state.panel = p; state.logEl = log; state.headerEl = t;
}

function setHeader(text) {
  ensurePanel();
  if (state.headerEl) state.headerEl.textContent = text;
}

function logLine(text) {
  ensurePanel();
  const row = document.createElement('div');
  row.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  state.logEl.appendChild(row);
  state.panel.scrollTop = state.panel.scrollHeight;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
