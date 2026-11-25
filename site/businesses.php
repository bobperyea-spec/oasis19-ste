<?php
// Oasis19 business directory: /businesses -> businesses.php. Links to every published business page.
declare(strict_types=1);

const SB_BASE = 'https://qcsnxchphbtgumdazbpq.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc254Y2hwaGJ0Z3VtZGF6YnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzc0NDQsImV4cCI6MjEwODk1MzQ0NH0.9iTTsSe09SQR_I3RGaYWrPUv8wR3H0pGyYJIFc-abgQ';

function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function call(string $fn, array $args): ?array
{
    $ch = curl_init(SB_BASE . '/rest/v1/rpc/' . $fn);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($args === [] ? new stdClass() : $args),
        CURLOPT_HTTPHEADER => ['apikey: ' . SB_KEY, 'Authorization: Bearer ' . SB_KEY, 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4,
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) { return null; }
    $d = json_decode((string)$body, true);
    return is_array($d) ? $d : null;
}

// Cache for 10 minutes so the directory stays fast.
$cache = sys_get_temp_dir() . '/oasis19-biz-directory2.json';
$items = null;
if (is_file($cache) && time() - (int)filemtime($cache) < 600) {
    $d = json_decode((string)file_get_contents($cache), true);
    if (is_array($d)) { $items = $d; }
}
if ($items === null) {
    $list = call('public_businesses', []);
    if ($list === null) {
        http_response_code(503); header('Retry-After: 120'); header('Cache-Control: no-store');
        echo '<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Temporarily unavailable | Oasis19</title><p>The directory could not be loaded. Please try again in a few minutes.</p>';
        exit;
    }
    $items = [];
    foreach (array_slice($list, 0, 300) as $row) {
        $slug = is_array($row) && isset($row['slug']) ? (string)$row['slug'] : '';
        if (!preg_match('/^[a-z0-9-]{3,60}$/', $slug)) { continue; }
        $b = call('public_business', ['p_slug' => $slug]);
        if (!is_array($b) || empty($b['name']) || !is_string($b['name'])) { continue; }
        $dec = fn($v) => is_string($v) ? trim(html_entity_decode($v, ENT_QUOTES | ENT_HTML5, 'UTF-8')) : '';
        $tag = $dec($b['tagline'] ?? '');
        $abt = trim((string)preg_replace('/\s+/u', ' ', $dec($b['about'] ?? '')));
        $blurb = $tag;
        if ($blurb === '' && $abt !== '') {
            $blurb = mb_strlen($abt, 'UTF-8') > 150 ? rtrim(mb_substr($abt, 0, 147, 'UTF-8'), " ,.;:-") . '...' : $abt;
        }
        $svc = [];
        foreach ((is_array($b['services'] ?? null) ? $b['services'] : []) as $sv) {
            if (is_string($sv) && trim($sv) !== '') { $svc[] = trim(explode(' | ', $dec($sv), 2)[0]); }
            if (count($svc) >= 3) { break; }
        }
        $logo = '';
        if (isset($b['logo_url']) && is_string($b['logo_url']) && preg_match('#^https://[^\s"<>\'\\\\]+$#', $b['logo_url'])) { $logo = $b['logo_url']; }
        $items[] = ['slug' => $slug, 'name' => $dec($b['name']), 'tagline' => $blurb, 'services' => $svc, 'logo' => $logo];
    }
    usort($items, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    @file_put_contents($cache, json_encode($items));
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
$ld = ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => 'Oasis19 business directory', 'url' => 'https://oasis19.com/businesses',
  'mainEntity' => ['@type' => 'ItemList', 'itemListElement' => array_map(fn($i, $n) => ['@type' => 'ListItem', 'position' => $n + 1, 'url' => 'https://oasis19.com/b/' . $i['slug'], 'name' => $i['name']], $items, array_keys($items))]];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Business directory | Oasis19</title>
<meta name="description" content="Businesses on Oasis19. Browse their pages, visit their websites, and read their latest updates.">
<link rel="canonical" href="https://oasis19.com/businesses">
<script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<style>
body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#faf9fd;color:#1d1b2e;line-height:1.6}
a{color:#3D1F8C}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
.top{background:#fff;border-bottom:1px solid #e6e2f2}.top .wrap{display:flex;align-items:center;justify-content:space-between;min-height:48px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;text-decoration:none}.brand img{width:32px;height:32px}
h1{color:#3D1F8C;margin:28px 0 8px}
ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
li{background:#fff;border:1px solid #e6e2f2;border-radius:14px;padding:16px}
li a{font-weight:700;font-size:1.1rem}li p{margin:4px 0 0;color:#444}
li .sv{font-size:.85rem;color:#3D1F8C;margin-top:10px}
li .lg{height:56px;display:flex;align-items:center;margin-bottom:10px}li .lg img{max-height:56px;max-width:160px;width:auto;height:auto;object-fit:contain}
.btn{display:inline-block;background:#f08a24;color:#1d1b2e;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700}
footer{margin:36px 0;color:#666;font-size:.9rem}footer a{margin-right:14px}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="https://oasis19.com/"><img src="/images/logo-v2.png" width="32" height="32" alt=""><span>Oasis19</span></a><a href="https://oasis19.com/community/">Join the conversation</a></div></header>
<main class="wrap">
<h1>Businesses on Oasis19</h1>
<p>Each business has its own page, a link to its website, and updates that Oasis19 members can see.</p>
<ul>
<?php foreach ($items as $i): ?>
<li><?php if (!empty($i['logo'])): ?><div class="lg"><img src="<?= e($i['logo']) ?>" alt="" loading="lazy"></div><?php endif; ?><a href="/b/<?= e($i['slug']) ?>"><?= e($i['name']) ?></a><?php if ($i['tagline'] !== ''): ?><p><?= e($i['tagline']) ?></p><?php endif; ?><?php if (!empty($i['services'])): ?><p class="sv"><?= e(implode(' · ', $i['services'])) ?></p><?php endif; ?></li>
<?php endforeach; ?>
</ul>
<p><a class="btn" href="/join">List your business, free</a></p>
</main>
<footer><div class="wrap"><a href="https://oasis19.com/">Home</a><a href="https://oasis19.com/oasis/">Oases</a><a href="https://oasis19.com/community/privacy.html">Privacy</a><a href="https://oasis19.com/community/terms.html">Terms</a></div></footer>
</body>
</html>
