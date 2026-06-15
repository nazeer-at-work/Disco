const startBtn = document.getElementById('start');
const statusEl = document.getElementById('status');
const batchSizeEl = document.getElementById('batchSize');

const setStatus = m => { statusEl.textContent = m; };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    const tab = await activeTab();
    if (!tab?.id || !tab.url?.startsWith('https://carve.photos/')) {
      throw new Error('Open https://carve.photos/upload first.');
    }
    const batchSize = Math.max(1, Math.min(20, Number(batchSizeEl.value) || 7));
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'START_BATCH', batchSize });
    if (!res?.ok) throw new Error(res?.error || 'Could not start.');
    setStatus('Running — watch the in-page panel. You can close this popup.');
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  } finally {
    startBtn.disabled = false;
  }
});
