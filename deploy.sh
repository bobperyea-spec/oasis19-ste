#!/bin/bash
# Copies the repo into the live site. Run by cron after git pull.
cd "$(dirname "$0")" || exit 1
D=/home/oasirble/public_html
cp -f community/*.js community/*.css community/*.html community/*.png "$D/community/" 2>/dev/null
cp -f site/images/*.png "$D/images/" 2>/dev/null
exit 0
