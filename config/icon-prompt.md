<!--
  Single shared prompt for ALL icons (no per-app config needed).
  IMPORTANT: do NOT reference the app/brand by name here — naming a brand makes the
  image model refuse ("can't reproduce a copyrighted logo"). Instead we send the
  logo image and ask it to convert THE PROVIDED IMAGE. {{appName}} is intentionally
  not used in the prompt (it's still used to fetch the reference + name the file).
  Everything below the --- marker is sent to the image model verbatim, with the
  reference logo attached as an image.
-->
---
Convert the attached image into a premium disco-themed 3D app icon. Treat the attached image purely as the shape-and-color source.
Preserve the exact shape, silhouette, and colors shown in the attached image — the colors in the image must remain the dominant palette and the result must stay visually identical in form and color (e.g. if the image is green, it stays green, not rainbow). Apply the disco treatment as reflective, glossy 3D material, chrome edges, subtle sparkles, soft holographic accents and dynamic lighting that ENHANCE the existing colors — do NOT recolor, hue-shift, neon-wash, or replace them with a rainbow. Maintain a clean premium look rather than a literal disco ball.
SHAPE FIDELITY (strict): reproduce ONLY the shapes present in the attached image. Do NOT add, invent, or extend any extra corners, tails, notches, spikes, frames, borders, plates, or background tiles that are not in the source. The outer silhouette must match the attached image exactly — same proportions, same number of points/corners.
NO SHADOWS (strict): fully transparent background (alpha = 0). Absolutely NO drop shadow, cast shadow, ground shadow, contact shadow, reflection puddle, or dark gradient beneath, behind, or around the icon. Every pixel outside the icon silhouette must be fully transparent. Lighting and depth live ONLY on the object itself, not on the background.
COMPOSITION (strict): the icon must be perfectly centered in a square 1:1 frame with equal margins on all four sides. Upright and front-facing — no rotation, no tilt, no perspective skew, no off-center placement. The subject should fill about 80% of the frame, fully visible and never cropped. Keep ALL glow, sparkle, reflection and light effects contained inside the frame and symmetric around the center — no light rays, streaks, or elements drifting to one side or bleeding off the edges. A single, self-contained, balanced object.
Strong depth, modern launcher icon aesthetic, transparent background, optimized for Android and Play Store branding.
