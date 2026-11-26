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

# SEO 2026-11-22: robots.txt (backed up once), then add share image, Twitter tags and schema to the two landing pages (backed up once, idempotent)
if [ -f site/robots.txt ]; then
  [ -e "$D/robots.txt.bak-2026-11-22" ] || cp "$D/robots.txt" "$D/robots.txt.bak-2026-11-22" 2>/dev/null
  cp -f site/robots.txt "$D/robots.txt"
fi
for f in index.html about.html; do
  p="$D/$f"
  if [ -f "$p" ] && ! grep -q 'seo-extra-2026-11-22' "$p"; then
    [ -e "$p.bak-2026-11-22-pre-seo" ] || cp "$p" "$p.bak-2026-11-22-pre-seo"
    awk 'FNR==NR{s=s $0 "\n"; next} /<\/head>/ && !d {printf "%s", s; d=1} {print}' site/seo/head-extra.html "$p" > "$p.tmp" && [ -s "$p.tmp" ] && cp "$p.tmp" "$p"
    rm -f "$p.tmp"
  fi
done

# Business profiles 2026-11-22: public page renderer (backed up once if one already exists)
if [ -f site/business.php ]; then
  [ -e "$D/business.php" ] && [ ! -e "$D/business.php.bak-2026-11-22" ] && cp "$D/business.php" "$D/business.php.bak-2026-11-22"
  cp -f site/business.php "$D/business.php"
fi
# Business directory 2026-11-23
if [ -f site/businesses.php ]; then
  cp -f site/businesses.php "$D/businesses.php"
fi
# Oasis19 logo for site-owned oases 2026-11-23
mkdir -p "$D/community/img" && cp -f community/img/*.png "$D/community/img/" 2>/dev/null
# Shared-post pages 2026-11-25: /p/{id} renderer
if [ -f site/post.php ]; then
  cp -f site/post.php "$D/post.php"
fi
# Home page 2026-11-25: new text landing page at the root (old index.html and about.html backed up once)
if [ -f site/home.html ]; then
  [ -e "$D/index.html.bak-2026-11-25-pre-home" ] || cp "$D/index.html" "$D/index.html.bak-2026-11-25-pre-home" 2>/dev/null
  cp -f site/home.html "$D/index.html"
  cp -f site/home.js "$D/home.js"
  if [ -f "$D/about.html" ] && ! grep -q 'noindex-2026-11-25' "$D/about.html"; then
    [ -e "$D/about.html.bak-2026-11-25-pre-noindex" ] || cp "$D/about.html" "$D/about.html.bak-2026-11-25-pre-noindex"
    sed -i 's#</head>#<meta name="robots" content="noindex,follow"><!-- noindex-2026-11-25 -->\n</head>#' "$D/about.html"
  fi
fi
# Guides 2026-11-26: /guides/ index and /guides/{slug}/ pages rendered by guide.php (no .htaccess change needed)
if [ -f site/guide.php ]; then
  cp -f site/guide.php "$D/guide.php"
  mkdir -p "$D/guides"
  printf '%s\n' '<?php $GUIDE_SLUG = ""; require dirname(__DIR__) . "/guide.php";' > "$D/guides/index.php"
  for S in ad-free-chronological-social-media facebook-groups-alternative privacy-and-your-posts new-social-media-sites; do
    mkdir -p "$D/guides/$S"
    printf '%s\n' "<?php \$GUIDE_SLUG = \"$S\"; require dirname(__DIR__, 2) . \"/guide.php\";" > "$D/guides/$S/index.php"
  done
fi
# Team page headers 2026-11-26: geometric banners in team colors (no logos)
if [ -d community/img/team-headers ]; then
  mkdir -p "$D/community/img/team-headers" && cp -f community/img/team-headers/*.svg "$D/community/img/team-headers/" 2>/dev/null
fi
exit 0
