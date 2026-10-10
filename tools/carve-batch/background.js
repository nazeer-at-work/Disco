// Background service worker for Carve Batch extension
// - Clears carve.photos browsing data and cookies
// - Tracks and verifies actual downloads via chrome.downloads API
// - Keeps system awake during batch runs

// 1. Keep-awake management
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'KEEP_AWAKE') {
    try { chrome.power.requestKeepAwake('display'); } catch {}
  } else if (msg?.type === 'RELEASE_AWAKE') {
    try { chrome.power.releaseKeepAwake(); } catch {}
  }
});

// 2. Clear site data & cookies
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'CLEAR_SITE_DATA') return;
  const origins = ['https://carve.photos'];
  (async () => {
    try {
      await chrome.browsingData.remove(
        { origins },
        {
          cache: true,
          cacheStorage: true,
          cookies: true,
          formData: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true,
          webSQL: true,
          fileSystems: true,
        },
      );
      if (chrome.cookies) {
        const cookies = await chrome.cookies.getAll({ domain: 'carve.photos' });
        for (const c of cookies) {
          const url = `http${c.secure ? 's' : ''}://${c.domain.replace(/^\./, '')}${c.path}`;
          await chrome.cookies.remove({ url, name: c.name }).catch(() => {});
        }
      }
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // async
});

// 3. Download Verification & Tracking
const activeWatchers = new Map();
const watcherPromises = new Map();
let watcherSeq = 0;

chrome.downloads.onCreated.addListener((item) => {
  const itemTime = item.startTime ? new Date(item.startTime).getTime() : Date.now();
  for (const [wid, watcher] of activeWatchers.entries()) {
    if (!watcher.downloadId) {
      if (itemTime >= watcher.armedAt - 2500) {
        watcher.downloadId = item.id;
        watcher.filename = item.filename || '';
        if (item.state === 'complete') {
          watcher.resolve({ ok: true, filename: item.filename, id: item.id });
          activeWatchers.delete(wid);
        }
        break;
      }
    }
  }
});

chrome.downloads.onChanged.addListener((delta) => {
  for (const [wid, watcher] of activeWatchers.entries()) {
    if (watcher.downloadId === delta.id) {
      if (delta.filename?.current) {
        watcher.filename = delta.filename.current;
      }
      if (delta.state) {
        if (delta.state.current === 'complete') {
          watcher.resolve({ ok: true, filename: watcher.filename, id: delta.id });
          activeWatchers.delete(wid);
        } else if (delta.state.current === 'interrupted') {
          watcher.resolve({ ok: false, error: delta.error?.current || 'DOWNLOAD_INTERRUPTED' });
          activeWatchers.delete(wid);
        }
      }
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ARM_DOWNLOAD_WATCH') {
    const wid = ++watcherSeq;
    const timeoutMs = msg.timeoutMs || 25000;
    const armedAt = msg.since || Date.now();
    let timer;

    const promise = new Promise((resolve) => {
      timer = setTimeout(async () => {
        if (activeWatchers.has(wid)) {
          const w = activeWatchers.get(wid);
          activeWatchers.delete(wid);

          if (w.downloadId) {
            try {
              const [item] = await chrome.downloads.search({ id: w.downloadId });
              if (item?.state === 'complete') {
                resolve({ ok: true, filename: item.filename, id: item.id });
                return;
              }
            } catch {}
          }
          resolve({
            ok: false,
            error: w.downloadId ? 'DOWNLOAD_TIMEOUT_INCOMPLETE' : 'NO_DOWNLOAD_STARTED',
          });
        }
      }, timeoutMs);

      activeWatchers.set(wid, {
        armedAt,
        baseName: msg.baseName || '',
        downloadId: null,
        filename: '',
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
      });
    });

    watcherPromises.set(wid, promise);
    sendResponse({ ok: true, watcherId: wid });
    return;
  }

  if (msg?.type === 'WAIT_FOR_DOWNLOAD') {
    const promise = watcherPromises.get(msg.watcherId);
    if (!promise) {
      sendResponse({ ok: false, error: 'WATCHER_NOT_FOUND' });
      return;
    }
    watcherPromises.delete(msg.watcherId);
    promise.then((res) => sendResponse(res));
    return true; // async
  }

  if (msg?.type === 'DIRECT_DOWNLOAD') {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      saveAs: false,
      conflictAction: 'uniquify',
    }).then(
      (downloadId) => sendResponse({ ok: true, downloadId }),
      (err) => sendResponse({ ok: false, error: String(err) }),
    );
    return true; // async
  }
});
