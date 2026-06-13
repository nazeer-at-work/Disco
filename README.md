# Icon Pack Template

A clean, **Android-only** React Native template for building app icon packs at
scale (1000+ icons) without bloating the APK.

- **Generate** icons with Google Gemini — art style lives in one editable file
  (`config/icon-prompt.md`).
- **Map** icons to apps from the community-maintained **Lawnicons** appfilter
  (Apache-2.0) instead of manual device-pulls.
- **Ship** with one command: `npm run release` bumps the version and writes every
  identity field, then builds the AAB/APK.

Per-icon launcher drawables are capped (≤384px / webp q80) and the in-app grid
reuses them via Android resource URIs, so size grows ~15–20 KB per icon with no
duplicate copies.

## Quick start
```bash
npm install
# edit config/pack.config.json, then:
npm run release                     # apply identity/version
GEMINI_API_KEY=... npm run generate:icons -- --names "YouTube,Spotify"
npm run build:icon-pack             # cap + wire drawables and grid
npm run build:appfilter             # component→icon mapping from Lawnicons
npm run android                     # run it
```

**Full guide:** [ONBOARDING.md](ONBOARDING.md) · **Attribution:** [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## Scripts
| Command | Does |
|---|---|
| `npm run generate:icons` | Gemini image generation → `assets/icons-src/` (transparent) |
| `npm run build:icon-pack` | Render + size-cap drawables, refresh in-app grid map |
| `npm run build:appfilter` | Build `appfilter.xml` from Lawnicons + `config/aliases.json` |
| `npm run release` | Version bump + config sync + build (`--patch`/`--minor`/`--major`/`--version`, `--aab`/`--apk`/`--install`) |
| `npm run android` / `start` / `lint` / `test` | Dev run / Metro / lint / tests |
