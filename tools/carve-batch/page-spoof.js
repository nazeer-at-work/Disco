// Injected into the MAIN world at document_start.
// Spoofs visibility and provides requestAnimationFrame fallbacks so carve.photos
// processes images continuously even when the tab is hidden / backgrounded.

(function () {
  // 1. Spoof Document and Window visibility / focus state
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true,
    });
    Object.defineProperty(document, 'webkitVisibilityState', {
      get: () => 'visible',
      configurable: true,
    });
    Object.defineProperty(document, 'webkitHidden', {
      get: () => false,
      configurable: true,
    });
    Document.prototype.hasFocus = () => true;
  } catch (e) {}

  // 2. Prevent the page from receiving visibilitychange or blur events
  const swallowEvent = (e) => {
    e.stopImmediatePropagation();
  };

  window.addEventListener('visibilitychange', swallowEvent, true);
  document.addEventListener('visibilitychange', swallowEvent, true);
  window.addEventListener('webkitvisibilitychange', swallowEvent, true);
  document.addEventListener('webkitvisibilitychange', swallowEvent, true);
  window.addEventListener('blur', swallowEvent, true);

  // 3. requestAnimationFrame fallback for background execution
  // Native requestAnimationFrame stops firing completely when a tab is hidden.
  // We wrap rAF so that if native rAF doesn't fire within 30ms, setTimeout fires it.
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCAF = window.cancelAnimationFrame.bind(window);

  const activeRafs = new Map();
  let rafIdCounter = 1;

  window.requestAnimationFrame = function (callback) {
    const id = rafIdCounter++;
    let executed = false;

    const run = (timestamp) => {
      if (executed) return;
      executed = true;
      activeRafs.delete(id);
      callback(timestamp);
    };

    const nativeId = nativeRAF((time) => {
      run(time);
    });

    // Fallback: If native rAF is frozen by Chrome (hidden tab), execute via setTimeout
    const timeoutId = setTimeout(() => {
      run(performance.now());
    }, 30);

    activeRafs.set(id, { nativeId, timeoutId });
    return id;
  };

  window.cancelAnimationFrame = function (id) {
    const entry = activeRafs.get(id);
    if (entry) {
      nativeCAF(entry.nativeId);
      clearTimeout(entry.timeoutId);
      activeRafs.delete(id);
    }
  };
})();
