<!--
  Icon generation prompt template. Edit this file to define THIS pack's art style.
  Placeholders filled at generation time:
    {{appName}}    - the app's display name (e.g. "YouTube")
    {{brandLock}}  - per-app brand lock from config/brand-locks.json (optional)
  Everything below the marker line is sent to the image model verbatim.
  Keep the "transparent background" instruction so icons need no background removal.
-->
---
Create a single Android app icon source image for a disco 3D style icon pack. Subject: {{appName}} app.
Brand fidelity is mandatory: keep the official app logo mark, recognisable geometry, and official brand color palette.
Color fidelity is mandatory: preserve the same brand hues from the official logo; do not recolor, shift hue, mute saturation, or apply an alternate palette.
Do not invent a new symbol, do not replace the logo shape, and do not alter core logo proportions.
Treat it as an exact logo recreation in plush 3D material, not a reinterpretation or a logo-like variant.
Mandatory brand lock for this app: {{brandLock}}
No enclosing badge, no extra ring, no random glyph, no secondary icon plate unless it is part of the official logo.
Typography is strictly forbidden unless it exists in the official reference mark.
Do NOT add app names, brand names, letters, words, numbers, slogans, or any readable characters.
Text-free output is mandatory: if uncertain, remove all lettering and keep only the symbol/mark.
Style target: short-loop sherpa/teddy-fleece plush texture (soft nubby loops), not long-hair fur.
Render as a simplified rounded 3D icon object with clean geometric silhouette and bold color blocking, mascot-like but icon-readable.
Material cues: chenille/sherpa fabric pile, soft seams, cushioned stuffed volume, subtle specular on non-fabric accents.
Soft studio lighting, clean silhouette, centered composition, no text, no watermark, no extra objects, no border.
Background MUST be fully transparent (alpha = 0). Output RGBA with a transparent background — no solid fill, no gradient, no plate, no shadow touching the edges.
Subject should occupy about 82% of canvas area (leave ~9% padding on each side), subject fully visible and not cropped.
Output must be a square image, 1024x1024, RGBA with transparency.
