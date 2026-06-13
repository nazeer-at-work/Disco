#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")" && pwd)"

make_icon() {
  local name="$1"
  local hue="$2"
  local glyph="$3"
  cat > "$OUT_DIR/${name}.svg" <<SVG
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#7B8799" flood-opacity="0.35"/>
    </filter>
    <linearGradient id="g" x1="20" y1="18" x2="108" y2="110" gradientUnits="userSpaceOnUse">
      <stop stop-color="$hue" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#E9EDF2" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <g filter="url(#shadow)">
    <rect x="16" y="14" width="96" height="96" rx="30" fill="#F4F5F7"/>
    <rect x="28" y="26" width="72" height="72" rx="24" fill="url(#g)"/>
    <ellipse cx="54" cy="40" rx="18" ry="8" fill="white" fill-opacity="0.35" transform="rotate(-18 54 40)"/>
  </g>
  <text x="64" y="72" text-anchor="middle" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#13364D">$glyph</text>
</svg>
SVG
}

make_icon "phone" "#2DC36A" "PH"
make_icon "message" "#3AB8FF" "MSG"
make_icon "user" "#FF866D" "U"
make_icon "clock" "#C487FF" "CL"
make_icon "folder" "#F1B650" "FD"
make_icon "music" "#6EA8FF" "MU"
make_icon "settings" "#C8CDD7" "ST"
make_icon "camera" "#4F6078" "CAM"
make_icon "calendar" "#4CB6A2" "31"

echo "Generated SVG icons in $OUT_DIR"
