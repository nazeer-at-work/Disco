# Icon Pack Template — Onboarding

A lean, Android-only React Native icon-pack template. Two pipelines:
**generate icons** (Google Gemini, prompt-driven) and **map icons** (from
Lawnicons). Built to scale to 1000+ icons without the APK ballooning.

## Prerequisites
- Node >= 22.11, Android SDK + a device/emulator, `adb` on PATH.
- `GEMINI_API_KEY` in your environment (only needed to generate icons).
- `npm install`

The template ships **plain** — no icons and no mappings. You name it, generate
icons, and build.

## Create a new pack (the whole loop)

1. **Name the pack** — pick any name; this renames everything internal (package,
   drawable prefix, icon component, signing props) and the display name/applicationId:
   ```bash
   npm run setup -- --name "Disco"                       # or any name
   npm run setup -- --name "Disco" --id com.studio.disco # custom package/app id
   ```
   Then sync versions/labels and (optionally) the store URL:
   ```bash
   npm run release            # writes version into gradle, strings, .env, etc.
   ```
   (Re-run `setup` any time to rename again — the current name is tracked in
   `config/pack.config.json` → `brand`.)

2. **Define the art style** — edit `config/icon-prompt.md` (everything below the
   `---` is the prompt; keep `{{appName}}`, `{{brandLock}}`, and the transparent-
   background line). Optionally add per-app locks in `config/brand-locks.json`.

3. **List the apps** — edit `config/icons.json`
   (`{ "apps": [{ "name": "YouTube" }, ...] }`). `slug` is derived from the name.

4. **Generate icons** → `assets/icons-src/<slug>.webp` (transparent, local-only):
   ```bash
   GEMINI_API_KEY=... npm run generate:icons            # all missing
   GEMINI_API_KEY=... npm run generate:icons -- --names "YouTube,Spotify" --overwrite
   npm run generate:icons -- --dry-run                  # preview prompts, no API call
   ```

5. **Build the pack** — caps icon size + refreshes drawables and the in-app grid:
   ```bash
   npm run build:icon-pack
   ```

6. **Map icons to apps** — generate `appfilter.xml` from Lawnicons + curated overrides:
   ```bash
   npm run build:appfilter
   ```
   Check the "NO component mapping yet" report; add fixes to `config/aliases.json`.

7. **Run / ship**:
   ```bash
   npm run android                       # dev run on device/emulator
   npm run release -- --minor --aab      # bump version + build a Play AAB
   npm run release -- --patch --apk --install
   ```

## How icons stay a consistent size
Every icon is normalized at build time onto a uniform `maxIconPx` square canvas,
with its content scaled so the longest edge is `iconStyle.contentScale` (0.82) of
the canvas, then centered. So regardless of each source's aspect ratio — or how
the generator framed it — every drawable is the same size with the same padding,
and the grid + home screen look even. Rounded "container" icons use
`iconStyle.roundedContentScale` (0.94). Tune these in `config/icon-pack.json`.

## How size stays flat at scale
- Launcher drawables are capped to `iconStyle.maxIconPx` (384px) + `webpQuality`
  (80) in `config/icon-pack.json` → ~15–40 KB each. 547 icons ≈ 11 MB; 1000 ≈ ~20 MB.
- The in-app grid renders the **same** drawables via `{ uri: 'ic_disco_<slug>' }`
  (RN Android resource lookup) — no duplicate gallery copies, no 1000 `require()`s.
- Single density folder (`drawable-nodpi`), no per-density duplication.

## What's git-ignored (kept local)
- `assets/icons-src/` — the large 1024px masters (regenerate any time).
- `assets/logo-refs/` — optional reference logos.
- `config/lawnicons/*.xml` — cached upstream mapping (re-fetched on demand).
- Build outputs, `.env`, keystores/secrets.

## Layout
```
config/   pack.config.json · icon-prompt.md · brand-locks.json · icons.json
          · aliases.json · icon-pack.json (render settings) · lawnicons/
scripts/  generate-icons.mjs · build-appfilter.mjs · generate-icon-pack.js
          · generate-gallery-manifest.js · release.mjs
src/      RN app (domain / application / infrastructure / presentation)
.claude/skills/icon-generator/   the generation workflow as a Claude skill
```

See `THIRD_PARTY_NOTICES.md` for Lawnicons (Apache-2.0) attribution.
