#!/bin/bash
# Copies the repo into the live site. Run by cron after git pull.
cd "$(dirname "$0")" || exit 1
D=/home/oasirble/public_html
cp -f community/*.js community/*.css community/*.html community/*.json community/*.png "$D/community/" 2>/dev/null
cp -f site/images/*.png "$D/images/" 2>/dev/null
# One-time-safe: point pages at logo-v2.png so browsers drop the cached old logo
for f in index.html about.html app.html community/index.html; do
  p="$D/$f"
  if grep -q 'images/logo\.png' "$p" 2>/dev/null; then
    [ -e "$p.bak-2026-11-22-pre-logo" ] || cp "$p" "$p.bak-2026-11-22-pre-logo"
    sed -i 's#images/logo\.png#images/logo-v2.png#g' "$p"
  fi
done
exit 0
