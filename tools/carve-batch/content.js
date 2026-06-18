/* Carve Batch — process a folder of images through carve.photos free flow.
 * Processes N at a time (default 7); after each N it clears carve's site storage
 * IN PLACE (no reload — a cleared session continues in the same page) and keeps
 * going until the whole folder is done. Files stay in memory; no persistence. */

const state = { running: false, panel: null, logEl: null };
const keepAlive = { audio: null, ctx: null };

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

// Keep this tab from being throttled/frozen/discarded while we run in the
// background. Two mechanisms: (1) a looping near-silent audio element marks the
// tab "playing media" so Chrome exempts its timers from background throttling;
// (2) a faint WebAudio tone reinforces the audible state; (3) the background
// worker holds a chrome.power lock so the machine/display won't sleep.
// Must be started from within a user gesture (the folder pick) to satisfy autoplay.
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
      gain.gain.value = 0.0008; // inaudible but non-zero -> tab counts as audible
      osc.frequency.value = 20;
      osc.connect(gain); gain.connect(ctx.destination); osc.start();
      keepAlive.ctx = ctx;
    }
    keepAlive.ctx.resume().catch(() => {});
  } catch {}
  try { chrome.runtime.sendMessage({ type: 'KEEP_AWAKE' }); } catch {}
}

function stopKeepAlive() {
  try { keepAlive.audio && keepAlive.audio.pause(); } catch {}
  try { keepAlive.ctx && keepAlive.ctx.suspend(); } catch {}
  try { chrome.runtime.sendMessage({ type: 'RELEASE_AWAKE' }); } catch {}
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type !== 'START_BATCH') return;
  if (state.running) { sendResponse({ ok: false, error: 'Already running.' }); return; }
  runBatch(msg.batchSize || 7)
    .then(() => sendResponse({ ok: true }))
    .catch(e => { logLine('Failed: ' + e.message); sendResponse({ ok: false, error: e.message }); });
  return true; // async
});

async function runBatch(batchSize) {
  if (!location.pathname.startsWith('/upload')) throw new Error('Open https://carve.photos/upload first.');
  state.running = true;
  ensurePanel();
  try {
    logLine('Pick the source folder...');
    const files = (await pickFolderFiles())
      .filter(f => /\.(webp|png|jpe?g)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!files.length) throw new Error('No images (webp/png/jpg) in that folder.');
    startKeepAlive(); // folder pick is a user gesture -> audio autoplay allowed
    logLine(`Queue: ${files.length} images, ${batchSize} per session. (tab kept awake)`);

    let prevSrc = resultBlobSrc();

    for (let i = 0; i < files.length; i++) {
      const label = `[${i + 1}/${files.length}] ${files[i].name}`;
      try {
        logLine(`${label}: uploading...`);
        const input = await waitForFileInput(15000);
        await setInputFiles(input, [files[i]]);
        await sleep(1000);

        logLine(`${label}: processing...`);
        const { src, btn } = await waitForResult(prevSrc, 180000);
        clickElement(btn); // single click of the exact "Download Free" button
        prevSrc = src;
        logLine(`${label}: downloaded.`);
        await sleep(2200);
      } catch (err) {
        if (err.message === 'LIMIT_REACHED') {
          logLine(`${label}: hit free limit — clearing session and retrying this image...`);
          await clearViaBrowsingData();
          await clearCarveStorage();
          await sleep(3000);
          prevSrc = resultBlobSrc();
          i -= 1; // retry the same image on the fresh session
          continue;
        }
        logLine(`${label}: ERROR ${err.message} (continuing)`);
      }

      // After every `batchSize`, reset the free session (no reload).
      const atSessionEnd = (i + 1) % batchSize === 0;
      const moreLeft = i + 1 < files.length;
      if (atSessionEnd && moreLeft) {
        logLine(`Session of ${batchSize} done. Clearing carve site data...`);
        const viaApi = await clearViaBrowsingData(); // DevTools-equivalent (normal window only)
        await clearCarveStorage();                    // in-page supplement + SW unregister
        logLine(viaApi ? 'Cleared via browsingData.' : 'browsingData unavailable (incognito?) — in-page clear only.');
        await sleep(3000); // let the SPA register the cleared session
        prevSrc = resultBlobSrc();
      }
    }
    logLine(`✅ ALL DONE — ${files.length} images. Check your Downloads folder.`);
  } finally {
    state.running = false;
    stopKeepAlive();
  }
}

// Ask the background worker to do a DevTools-style "Clear site data" via
// chrome.browsingData (forcible, per-origin). Returns false in incognito.
async function clearViaBrowsingData() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'CLEAR_SITE_DATA' });
    return !!res?.ok;
  } catch {
    return false;
  }
}

// In-page clear (fallback / incognito). Note: indexedDB.deleteDatabase may be
// blocked while the page holds the DB open — browsingData above is more reliable.
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
function pickFolderFiles() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.remove();
      files.length ? resolve(files) : reject(new Error('No files selected.'));
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

// ---------- download detection (carve.photos exact DOM) ----------
function isDisabled(el) {
  if (!el) return true;
  if (el.disabled === true) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  if (getComputedStyle(el).pointerEvents === 'none') return true;
  return false;
}
// The exact free-download button: <button class="download-button-main">Download Free</button>
function freeDownloadBtn() {
  return [...document.querySelectorAll('button.download-button-main')]
    .find(b => /free|бесплат/i.test(b.textContent || '')) || null;
}
// The processed result is shown as a blob image; its src changes per image.
function resultBlobSrc() {
  const img =
    document.querySelector('img.rectangle135[src^="blob:"]') ||
    document.querySelector('.frame83 img[src^="blob:"]');
  return img ? img.src : '';
}
// The "7 of 7 free photos used" modal becomes visible when the cap is hit.
function limitReached() {
  const modal = document.querySelector('.popup-menu1');
  return !!(modal && modal.offsetParent !== null && getComputedStyle(modal).display !== 'none');
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
  // Exactly one click — calling .click() AND dispatching a MouseEvent double-fires.
  if (typeof el.click === 'function') { el.click(); return; }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

// ---------- ui ----------
function ensurePanel() {
  if (state.panel) return;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;right:12px;bottom:12px;width:360px;max-height:45vh;overflow:auto;z-index:2147483647;background:#111;color:#f7f7f7;font:12px/1.4 monospace;padding:10px;border:1px solid #333;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  const t = document.createElement('div');
  t.textContent = 'Carve Batch';
  t.style.cssText = 'font-weight:700;margin-bottom:8px';
  const log = document.createElement('div');
  p.append(t, log);
  document.body.appendChild(p);
  state.panel = p; state.logEl = log;
}
function logLine(text) {
  ensurePanel();
  const row = document.createElement('div');
  row.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  state.logEl.appendChild(row);
  state.panel.scrollTop = state.panel.scrollHeight;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
