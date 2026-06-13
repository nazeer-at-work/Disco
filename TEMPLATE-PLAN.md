# Android Icon-Pack Template — Build Plan (v2)

Reusable, Android-only icon-pack template derived from `Fluff`. Same UI, none of
Fluff's bloat. Goal: a clean structure that scales to **1000+ apps without the
APK exploding**, with a prompt-driven AI icon generator, a Lawnicons-based mapping
pipeline, and one-command release.

## Locked decisions
- Fresh git repo · Full strip · Plan-first.
- Empty state keeps `not-found.webp` (only the "Request icon" button removed).
- Icon masters stay **local-only** (gitignored `assets/icons-src/`), fed at build.
- Remove feedback (request/report) + Supabase + native feedback methods; tighten
  manifest `<queries>`.
- **No Codex** — `.codex/` deleted; tooling becomes Claude-native (`.claude/skills/`).
- **No background-removal** — no carvekit/rembg, no Python venvs. Prompt the image
  model for transparent (RGBA) output directly; lightweight `sharp` flood-fill only
  if needed.
- **Image backend: Gemini** (Claude has no image API). Only the image call is Gemini;
  all tooling/skills are Claude.
- **Drop iOS** entirely (icon packs are Android-only).
- **Gallery at scale: native resource bridge** (no duplicate icon bytes, no
  1000-`require()` Metro cost).
- Prompt lives in an **editable file** (`config/icon-prompt.md`), not in code.

---

## 1. THE size problem (resolve first)

Measured: **547 icons, `drawable-nodpi` = 82 MB** (~150 KB avg; `youtube` only
15.8 KB). Cause: `generate-icon-pack.js` writes launcher drawables at **source
resolution, quality 100** — no cap, so source-heavy logos hit 1–2 MB each.

Hard truth: launcher drawables MUST ship in the APK (launchers read them as
installed resources — can't stream/defer). So we flatten the **per-icon slope**,
not eliminate growth:

1. **Cap each drawable** to ≤384px + webp quality ~80 in `build-icon-pack.mjs`
   (`cfg.iconStyle.maxIconPx`, `webpQuality`). 150 KB-avg → ~15 KB-avg.
   → **547 icons: 82 MB → ~10 MB; 1000 icons: ~15–18 MB.**
2. **Single density folder** — keep `drawable-nodpi` (one copy, no density dupes).
3. **Native resource bridge** for the in-app grid: resolve `ic_fluffy_<name>` → URI
   so the gallery renders the launcher drawable. Removes the separate gallery copy
   (~9 MB @1000) and the 1000-`require()` JS-bundle/Metro cost.

Target: **1000 apps ≈ 15–20 MB AAB** (vs Fluffy ~128 MB for 547).

---

## 2. Two pipelines (keep both, clean them up)

### A. Icon generation (AI) — prompt-driven
- Engine: `scripts/generate-icons.mjs` (ported from `webp-icon-agent`, de-Codexed).
- Backend: **Gemini** image model, `GEMINI_API_KEY` (OpenAI-compat base).
- Per app: fetch official logo → send logo + prompt → score/retry → save master.
- **Prompt sources (priority):** per-app override in `config/icons.json` →
  per-app line in `config/brand-locks.json` → default template in
  **`config/icon-prompt.md`** (placeholders `{{appName}}`, `{{brandLock}}`).
  Editing `icon-prompt.md` changes the whole pack's art style — no code change.
- **Transparent output:** prompt requests RGBA/transparent bg directly (replaces
  the old "#111111 + carvekit removal" flow). Optional `sharp` corner flood-fill
  fallback. No Python.
- A thin `.claude/skills/icon-generator/SKILL.md` documents the workflow.

### B. Component→icon mapping — from Lawnicons
- Source: Lawnicons `app/assets/appfilter.xml` (~3 MB, **Apache-2.0**), pinned to a
  commit, vendored at `config/lawnicons/appfilter.xml`. Same `<item component=…
  drawable=…/>` format as Fluff.
- `scripts/build-appfilter.mjs`: for each Lawnicons `<item>` whose icon-name we have
  a drawable for (join by slug, with `config/aliases.json` overrides), emit the item
  pointing at OUR `ic_fluffy_<name>`. Drop the rest.
- Replaces `build-component-mappings.js` + the adb device-pull + rules workflow.
- Add `THIRD_PARTY_NOTICES.md` (Lawnicons attribution) + `npm run sync:lawnicons`.

---

## 3. Target folder structure

```
config/
  pack.config.json        # identity: appId, namespace, appName, versionName/Code,
                          #   store URLs, theme color, keystore path, image backend
  icon-prompt.md          # EDITABLE prompt template ({{appName}}, {{brandLock}})
  brand-locks.json        # per-app prompt overrides
  icons.json              # icon list + per-app source overrides (was icon-pack.json)
  lawnicons/appfilter.xml # vendored, pinned
  aliases.json            # lawnicons-name → our drawable join overrides
scripts/
  generate-icons.mjs      # AI image gen (prompt from icon-prompt.md)
  build-appfilter.mjs     # Lawnicons → our appfilter.xml
  build-icon-pack.mjs     # render + CAP drawables, build RN gallery source
  release.mjs             # bump version + write config + build + (optional) install
  run-android.sh / install-apk.sh   # kept
.claude/skills/icon-generator/SKILL.md   # replaces .codex/ entirely
android/                  # Android only
assets/
  icons-src/   (gitignored — local 1024px masters)
  images/ fonts/ logo/
src/  (clean-arch RN app; feedback removed; native gallery bridge)
```

Scripts: **15 → 4** core. Deleted: `.codex/`, `remove-icon-backgrounds.js`,
`.venv-carvekit/`, `.venv-rembg/`, `extensions/`, `build-component-mappings.js`,
`apply-batch-component-mappings.js`, `normalize-icon-mappings.js`,
`normalize-icon-sizes.js`, `add-mapping-by-icon.js`, `import-icons-from-downloads.js`,
`supabase.sh`, `convert-icons-to-webp.js` (folded into build), `generate-gallery-*`
(replaced by bridge).

---

## 4. release.mjs (deployment / install)

Reads `config/pack.config.json`; one command does the rebrand+ship:
- `--patch|--minor|--major` or `--version x.y.z`; auto-increment `versionCode`.
- Writes: `android/app/build.gradle` (versionCode/Name, applicationId, namespace),
  `strings.xml` (app_name), `app.json`, `package.json` version,
  `src/config/app-links.ts` (store URLs/share text).
- Builds AAB (release) and/or arm64 APK; `--install` pushes to device.
- Signing: keystore path/alias from `pack.config.json` (never committed).

---

## 5. Strip / edit checklist (from Fluff)

DELETE: feedback API, `config/supabase.ts`, `supabase/`, `success.webp`+`error.webp`,
`ios/`, `Gemfile`, `.bundle/`, Podfile, `.codex/`, `extensions/`, the two venvs,
the removed scripts (§3), `.cache/`, build outputs, `*.apk`/`*.aab`.

EDIT:
- `IconGalleryScreen.tsx`: remove all `feedback*` state/handlers + 3 feedback modals;
  keep grid/search/preview; remove "Request icon" button (keep not-found empty state);
  swap gallery image source to the native bridge.
- `SettingsTabScreen.tsx`(+types): delete Feedback section + props.
- `LauncherBridge.ts`: drop feedback-only methods; keep `getSupportedLaunchers`,
  `openLauncherSettings`; ADD gallery resource-resolver method.
- Kotlin `LauncherIntegrationModule.kt`: remove feedback methods; add resource-name
  → URI resolver for the gallery bridge.
- `AndroidManifest.xml`: drop broad `MAIN/LAUNCHER` query; keep launcher package list
  + `HOME` query + theme intent-filters.
- `package.json`: prune scripts to core set; drop `@imgly/background-removal-node`,
  feedback/supabase deps; keep `sharp`.
- `react-native.config.js`: drop iOS.

---

## 6. Per-pack workflow (goes in ONBOARDING.md)

```
1. edit config/pack.config.json (appId, name, theme) + config/icon-prompt.md (style)
2. npm run generate:icons        # AI icons → assets/icons-src
3. npm run build:appfilter       # Lawnicons mapping → appfilter.xml
4. npm run build:icon-pack       # capped drawables + RN gallery source
5. npm run release -- --minor --install   # bump + build + install
```

---

## 7. Verify before done
1. `npm install` clean (no Python, no Pods).
2. Generate a few icons (transparent, no removal step).
3. `build:icon-pack` → confirm drawables are ~15 KB, APK single-digit/low-double MB.
4. `npm run android` → grid (via bridge) + search + preview + Apply/launchers + Settings
   (no Feedback) all work.
5. Apply pack on emulator → installed-app icons themed correctly (Lawnicons mapping).
6. `release.mjs --patch` → version bumped across all files; AAB builds.
7. `lint` + `test` green (feedback tests removed).

## Open follow-ups (not blocking)
- `scripts/rename-pack.js` if more rebrand automation wanted beyond release.mjs.
- CI workflow (optional).
```
