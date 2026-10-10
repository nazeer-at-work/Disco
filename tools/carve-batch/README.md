# Carve Batch — Chrome extension

Removes backgrounds on [carve.photos](https://carve.photos) for a whole folder,
working around the free per-session cap: it processes **N images (default 7)**, then
**clears carve's site storage and cookies in place** for a fresh free session, and
**auto-resumes** until the whole folder is done. It also keeps the tab **awake in the
background** (silent-audio keep-alive + a power lock) so you can switch apps while it runs.

Now includes **strict download verification**: it uses the `chrome.downloads` API to
track that the image file actually begins and completes writing to disk before marking
it as downloaded. If a button click fails to trigger a download, it attempts an in-page
direct blob fallback, detects limit modals, and stops if downloads fail consecutively.

## Load / Reload it
1. Go to `chrome://extensions` and enable **Developer mode**.
2. If already loaded, click the **🔄 reload** icon on **Carve Batch**.
   If loading for the first time, click **Load unpacked** → select `tools/carve-batch/`.
3. It appears as **Carve Batch** (v2.3.0).

## Run
1. From the pack root, stage the icons that need transparency:
   ```bash
   npm run carve:stage         # -> assets/carve-batches/<set>/batch-001 … NNN
   ```
2. Open `https://carve.photos/upload`.
3. Click the **Carve Batch** icon → set **images per session** (7) → **Start Batch**.
4. Pick a folder. The in-page panel logs progress:
   - Uploads each image.
   - Waits for ONNX processing to render the transparent blob.
   - Arms download watcher and clicks **Download Free**.
   - Verifies the download file completion on disk via `chrome.downloads`.
   - If UI click doesn't trigger download, uses direct blob fallback.
   - Resets site data and cookies after each session of N.
5. Results land in your **Downloads** folder.
6. Back in the pack root, import them:
   ```bash
   npm run carve:import        # Downloads -> assets/icons-src/<slug>.webp
   ```

## Notes / Known Safeguards
- **Verified Downloads ("keep a check"):** The extension will never falsely report "downloaded" unless `chrome.downloads` confirms the file has completed downloading on disk.
- **Direct Fallback:** If carve.photos' UI button click fails or gets throttled by Chrome, it triggers a fallback download directly from the processed transparent blob.
- **Free Quota & Limit Detection:** Detects English and Russian limit / quota popups (`daily-limit`, `limit reached`, `upgrade`, `лимит`). If a server-side IP limit is enforced, the batch halts cleanly and alerts you rather than running blank cycles.
- **Keep-awake:** Keeps the tab active with low-level audio + power lock.
