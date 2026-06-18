// Clears carve.photos site data the way DevTools "Clear site data" does — forcibly,
// per-origin, even while the page holds IndexedDB/cache open. Runs from the
// extension (content scripts can't call chrome.browsingData).
// NOTE: chrome.browsingData operates on the normal profile, NOT incognito.

// Keep the machine/display awake while a batch runs (released when it finishes).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'KEEP_AWAKE') { try { chrome.power.requestKeepAwake('display'); } catch {} }
  else if (msg?.type === 'RELEASE_AWAKE') { try { chrome.power.releaseKeepAwake(); } catch {} }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'CLEAR_SITE_DATA') return;
  const origins = ['https://carve.photos'];
  chrome.browsingData.remove(
    { origins },
    {
      cacheStorage: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true,
      webSQL: true,
      fileSystems: true,
    },
  ).then(
    () => sendResponse({ ok: true }),
    err => sendResponse({ ok: false, error: String(err) }),
  );
  return true; // async
});
