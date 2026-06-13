---
name: icon-generator
description: Generate this pack's app icons as transparent WebP masters with Google Gemini, then refresh the Android icon pack. Use when the user asks to create, add, refresh, or batch-generate icons for the pack.
---

# Icon Generator

Generates icon-pack source images for app logos and wires them into the Android
pack. Image generation uses **Google Gemini** (Claude has no image API); the art
style is defined entirely by `config/icon-prompt.md`.

## Inputs
- `GEMINI_API_KEY` (required to actually generate; `--dry-run` works without it)
- `config/icons.json` — the app list (`{ "apps": [{ "name", "slug?", "prompt?" }] }`)
- `config/icon-prompt.md` — the editable style prompt (`{{appName}}`, `{{brandLock}}`)
- `config/brand-locks.json` — per-app brand lock text, keyed by slug
- `assets/logo-refs/<slug>.(png|jpg|webp)` — optional reference logo for fidelity

## Workflow
1. Add the apps to `config/icons.json` (or use `--names`).
2. (Optional) Add a brand lock in `config/brand-locks.json` and/or a reference
   logo in `assets/logo-refs/` for stronger brand fidelity.
3. Generate masters → `assets/icons-src/<slug>.webp` (transparent RGBA, 1024px):
   ```bash
   GEMINI_API_KEY=... npm run generate:icons -- --names "YouTube,Spotify"
   # or generate everything missing in config/icons.json:
   GEMINI_API_KEY=... npm run generate:icons
   ```
4. Build the pack (caps icon size, refreshes drawables + in-app gallery map):
   ```bash
   npm run build:icon-pack
   ```
5. Refresh the launcher mapping from Lawnicons + curated overrides:
   ```bash
   npm run build:appfilter
   ```
6. Run it: `npm run android`.

## Notes
- Output is **transparent** straight from the model — there is no background-removal
  step and no Python tooling. If a model returns a filled background, refine
  `config/icon-prompt.md` (keep the "Background MUST be fully transparent" line).
- Masters in `assets/icons-src/` are git-ignored (local only) — they are the large
  source files; only the capped drawables are committed/shipped.
- Preview prompts without calling the API: `npm run generate:icons -- --dry-run`.
