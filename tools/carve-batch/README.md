# Carve Batch (7-per-session) — Chrome extension

Removes backgrounds on `carve.photos` for a whole folder, working around the free
per-session cap: it processes **N images (default 7)**, then **clears carve's site
storage + reloads** for a fresh free session, and **auto-resumes** until the entire
folder is done. The queue lives in the extension's storage, so it survives the
reloads (and incognito).

## Load it
1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `Disco/tools/carve-batch/`.
3. Click **Details** on the extension → enable **Allow in incognito** (you said you'll run incognito).

## Run
1. Open an **incognito** window → `https://carve.photos/upload`.
2. Click the extension icon → set **images per session** (7) → **Start / Resume Batch**.
3. Pick the source folder — for this project: `Disco/assets/icons-raw/` (the white-bg originals).
4. Leave the tab open. The in-page panel logs progress. It will: do 7 → clear session → reload → do the next 7 → … until done.
5. Results download to your **Downloads** folder. Move them into `assets/icons-src/`, then `npm run build:icon-pack`.

Buttons: **Reset job** clears the saved queue if you want to start over.

## Important / known risks
- **Selectors may need tuning.** The upload-input and free-download detection are
  heuristic (carried over from the older Fluff extension). If carve.photos changed
  its UI, edit the selectors / `scoreDownloadElement()` in `content.js`.
- **The reset only works if the cap is client-side.** This clears localStorage,
  sessionStorage, IndexedDB, Cache Storage and cookies for carve.photos. If carve
  enforces the cap server-side (by IP/account), clearing storage won't reset it —
  and incognito won't help either (same IP). Test one reset cycle first.
- **Downloads location** is the browser default (the page triggers the download);
  the extension can't redirect it without the `downloads` permission.
- **Keep the machine awake** for long runs (250 imgs ≈ 36 sessions). System sleep
  pauses it; screensaver/display-off is fine.

## First-time sanity check (do this before a 250 run)
Run with **just ~9 images** in a test folder so you see one full cycle:
upload 7 → "Clearing carve session + reloading" → page reloads → it resumes and
does the last 2 → "ALL DONE". If that cycle works, point it at `icons-raw/`.
