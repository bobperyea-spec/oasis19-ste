<?php
// Oasis19 public business profile: /b/{slug} -> business.php?slug={slug}
declare(strict_types=1);

const SB_BASE = 'https://qcsnxchphbtgumdazbpq.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc254Y2hwaGJ0Z3VtZGF6YnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzc0NDQsImV4cCI6MjEwODk1MzQ0NH0.9iTTsSe09SQR_I3RGaYWrPUv8wR3H0pGyYJIFc-abgQ';
const SITE    = 'https://oasis19.com';

function e($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function str_field($arr, string $key): string
{
    if (!is_array($arr) || !isset($arr[$key]) || !is_string($arr[$key])) {
        return '';
    }
    return trim($arr[$key]);
}

function safe_url(string $u, bool $httpsOnly = false): string
{
    $u = trim($u);
    if ($u === '' || preg_match('/[\x00-\x20<>"\'\\\\]/', $u)) {
        return '';
    }
    $p = parse_url($u);
    if (!is_array($p) || empty($p['scheme']) || empty($p['host'])) {
        return '';
    }
    $s = strtolower($p['scheme']);
    if ($s === 'https' || (!$httpsOnly && $s === 'http')) {
        return $u;
    }
    return '';
}

function cut(string $s, int $n): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $n, 'UTF-8');
    }
    return substr($s, 0, $n);
}

function rpc(string $fn, string $slug): array
{
    $ch = curl_init(SB_BASE . '/rest/v1/rpc/' . $fn);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['p_slug' => $slug]),
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . SB_KEY,
            'Authorization: Bearer ' . SB_KEY,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_CONNECTTIMEOUT => 4,
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        return ['ok' => false, 'data' => null];
    }
    $data = json_decode((string)$body, true);
    if ($data === null && strtolower(trim((string)$body)) !== 'null') {
        return ['ok' => false, 'data' => null];
    }
    return ['ok' => true, 'data' => $data];
}

function rel_time(int $ts): string
{
    $d = time() - $ts;
    if ($d < 60) return 'just now';
    $units = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
    foreach ($units as $u) {
        if ($d >= $u[0]) {
            $n = (int)floor($d / $u[0]);
            return $n . ' ' . $u[1] . ($n === 1 ? '' : 's') . ' ago';
        }
    }
    return 'just now';
}

function page_head(string $title, string $extra = ''): void
{
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . e($title) . '</title>' . $extra
        . '<style>body{font-family:"DM Sans",system-ui,sans-serif;background:#faf9fd;color:#1d1b2e;margin:0;padding:48px 20px;text-align:center}'
        . 'a{color:#3D1F8C}a:focus-visible{outline:3px solid #f08a24;outline-offset:2px}h1{color:#3D1F8C}</style></head><body>';
}

header('X-Content-Type-Options: nosniff');

$slug = isset($_GET['slug']) && is_string($_GET['slug']) ? $_GET['slug'] : '';
$notFound = function (): void {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: public, max-age=300');
    page_head('Page not found | Oasis19', '<meta name="robots" content="noindex">');
    echo '<main><h1>Page not found</h1><p>We could not find that business page. It may have moved or is not published yet.</p>'
        . '<p><a href="https://oasis19.com/">Back to Oasis19</a></p></main></body></html>';
    exit;
};

if (!preg_match('/^[a-z0-9-]{3,60}$/', $slug)) {
    $notFound();
}

$res = rpc('public_business', $slug);
if (!$res['ok']) {
    http_response_code(503);
    header('Retry-After: 120');
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    page_head('Temporarily unavailable | Oasis19', '<meta name="robots" content="noindex">');
    echo '<main><h1>Temporarily unavailable</h1><p>This page could not be loaded right now. Please try again in a few minutes.</p>'
        . '<p><a href="https://oasis19.com/">Back to Oasis19</a></p></main></body></html>';
    exit;
}
$b = $res['data'];
if (!is_array($b) || $b === [] || str_field($b, 'name') === '') {
    $notFound();
}

$pr = rpc('public_business_posts', $slug);
$posts = ($pr['ok'] && is_array($pr['data'])) ? $pr['data'] : [];

// ---- Fields ----
$name     = str_field($b, 'name');
$tagline  = str_field($b, 'tagline');
$about    = str_field($b, 'about');
$logo     = safe_url(str_field($b, 'logo_url'), true);
$website  = safe_url(str_field($b, 'website'));
$phone    = str_field($b, 'phone');
$email    = str_field($b, 'email');
$address  = str_field($b, 'address');
$hours    = str_field($b, 'hours');
$googleU  = safe_url(str_field($b, 'google_url'), true);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = '';
}
$lat = (isset($b['lat']) && is_numeric($b['lat'])) ? (float)$b['lat'] : null;
$lng = (isset($b['lng']) && is_numeric($b['lng'])) ? (float)$b['lng'] : null;
if ($lat === null || $lng === null || abs($lat) > 90 || abs($lng) > 180) {
    $lat = $lng = null;
}

$services = [];
if (isset($b['services']) && is_array($b['services'])) {
    foreach ($b['services'] as $s) {
        if (is_string($s) && trim($s) !== '') {
            $services[] = trim($s);
        }
    }
}
$reviews = [];
if (isset($b['reviews']) && is_array($b['reviews'])) {
    foreach ($b['reviews'] as $r) {
        if (is_array($r) && str_field($r, 'quote') !== '') {
            $reviews[] = $r;
        }
        if (count($reviews) >= 5) break;
    }
}

$canonical = SITE . '/b/' . $slug;
$descSrc = trim($tagline . ' ' . cut($about, 120));
$desc = cut(trim(preg_replace('/\s+/u', ' ', $descSrc) ?? $descSrc), 160);
$ogImage = $logo !== '' ? $logo : SITE . '/images/logo-v2.png';
$aboutTrim = cut(trim(preg_replace('/\s+/u', ' ', $about) ?? $about), 500);

// ---- JSON-LD ----
$ld = ['@context' => 'https://schema.org', '@type' => 'LocalBusiness', 'name' => $name];
if ($aboutTrim !== '') $ld['description'] = $aboutTrim;
$ld['url'] = $canonical;
$ld['image'] = $ogImage;
if ($phone !== '') $ld['telephone'] = $phone;
if ($email !== '') $ld['email'] = $email;
if ($address !== '') $ld['address'] = $address;
if ($lat !== null) {
    $ld['geo'] = ['@type' => 'GeoCoordinates', 'latitude' => $lat, 'longitude' => $lng];
}
$same = array_values(array_filter([safe_url($website, true), $googleU]));
if ($same) $ld['sameAs'] = $same;
$ldJson = json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($name) ?> | Oasis19</title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($canonical) ?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Oasis19">
<meta property="og:title" content="<?= e($name) ?> | Oasis19">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($canonical) ?>">
<meta property="og:image" content="<?= e($ogImage) ?>">
<meta name="twitter:card" content="summary">
<script type="application/ld+json"><?= $ldJson ?></script>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#faf9fd;color:#1d1b2e;line-height:1.6}
a{color:#3D1F8C}
a:focus-visible,button:focus-visible,iframe:focus-visible,.reviews:focus-visible{outline:3px solid #f08a24;outline-offset:2px}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.topbar{background:#fff;border-bottom:1px solid #e6e2f2}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:48px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#3D1F8C;text-decoration:none}
.brand img{width:32px;height:32px}
.card{background:#fff;border:1px solid #e6e2f2;border-radius:14px;padding:24px}
main{padding:24px 0 8px}
section{margin-top:28px}
h2.sec{color:#3D1F8C;font-size:1.4rem;margin:0 0 14px}
.hero{display:grid;grid-template-columns:2fr 1fr;gap:24px;align-items:start;background:none;border:0;padding:0}
.hero>div{background:#fff;border:1px solid #e6e2f2;border-radius:14px;padding:24px}
.logo{width:96px;height:96px;border-radius:14px;object-fit:cover;display:block;margin-bottom:14px;border:1px solid #e6e2f2}
h1{color:#3D1F8C;margin:0 0 6px;font-size:2rem;line-height:1.2}
.tagline{font-size:1.15rem;font-weight:500;color:#1d1b2e;margin:0 0 14px}
.contact h2{color:#3D1F8C;font-size:1.2rem;margin:0 0 12px}
.contact dl{margin:0}.contact dt{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-top:12px}
.contact dd{margin:2px 0 0;overflow-wrap:anywhere}
.reviews{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}
.reviews .card{flex:0 0 min(340px,85%);scroll-snap-align:start;margin:0}
blockquote{margin:0 0 10px;font-size:1.02rem}
cite{font-style:normal;font-weight:700;color:#3D1F8C}
.src{display:block;font-size:.85rem;margin-top:6px}
.map iframe{width:100%;height:320px;border:1px solid #e6e2f2;border-radius:14px;display:block}
.btn{display:inline-block;background:#3D1F8C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700}
.btn:hover{background:#2f1870}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.grid h3{margin:0 0 6px;color:#3D1F8C;font-size:1.05rem}.grid p{margin:0}
.post{margin-bottom:16px}
.post p{margin:0 0 10px;overflow-wrap:anywhere}
.post img{max-width:100%;height:auto;border-radius:10px;display:block}
.post time{color:#666;font-size:.85rem}
.muted{color:#666;font-size:.9rem}
footer{margin-top:36px;border-top:1px solid #e6e2f2;background:#fff;padding:24px 0;color:#666;font-size:.9rem}
footer a{margin-right:14px}
@media(max-width:760px){.hero{grid-template-columns:1fr}h1{font-size:1.6rem}}
</style>
</head>
<body>
<header class="topbar"><div class="wrap">
<a class="brand" href="https://oasis19.com/"><img src="/images/logo-v2.png" width="32" height="32" alt=""><span>Oasis19</span></a>
<a href="https://oasis19.com/community/">Join the conversation</a>
</div></header>
<main class="wrap">
<section class="hero" aria-labelledby="biz-name">
<div>
<?php if ($logo !== ''): ?><img class="logo" src="<?= e($logo) ?>" alt="<?= e($name) ?> logo" width="96" height="96"><?php endif; ?>
<h1 id="biz-name"><?= e($name) ?></h1>
<?php if ($tagline !== ''): ?><h2 class="tagline"><?= e($tagline) ?></h2><?php endif; ?>
<?php
if ($about !== '') {
    foreach (preg_split('/\R\s*\R/u', $about) ?: [] as $para) {
        $para = trim($para);
        if ($para !== '') echo '<p>' . nl2br(e($para), false) . '</p>';
    }
}
?>
</div>
<aside class="contact card" aria-labelledby="contact-h" style="align-self:start">
<h2 id="contact-h">Contact</h2>
<dl>
<?php if ($phone !== ''): $tel = preg_replace('/[^0-9+]/', '', $phone); ?>
<dt>Phone</dt><dd><a href="tel:<?= e($tel) ?>"><?= e($phone) ?></a></dd>
<?php endif; ?>
<?php if ($email !== ''): ?><dt>Email</dt><dd><a href="mailto:<?= e($email) ?>"><?= e($email) ?></a></dd><?php endif; ?>
<?php if ($website !== ''): $host = (string)parse_url($website, PHP_URL_HOST); $host = preg_replace('/^www\./i', '', $host); ?>
<dt>Website</dt><dd><a href="<?= e($website) ?>" rel="noopener nofollow"><?= e($host) ?></a></dd>
<?php endif; ?>
<?php if ($address !== ''): ?>
<dt>Address</dt><dd><?= nl2br(e($address), false) ?><br><a href="https://www.google.com/maps/dir/?api=1&amp;destination=<?= e(rawurlencode($address)) ?>" rel="noopener nofollow">Get directions</a></dd>
<?php endif; ?>
<?php if ($hours !== ''): ?><dt>Hours</dt><dd><?= nl2br(e($hours), false) ?></dd><?php endif; ?>
<?php if ($googleU !== ''): ?><dt>Reviews</dt><dd><a href="<?= e($googleU) ?>" rel="noopener nofollow">See reviews on Google</a></dd><?php endif; ?>
</dl>
</aside>
</section>

<?php if ($reviews): ?>
<section aria-labelledby="rev-h">
<h2 class="sec" id="rev-h">What customers say</h2>
<div class="reviews" tabindex="0" role="group" aria-labelledby="rev-h">
<?php foreach ($reviews as $r):
    $auth = str_field($r, 'author');
    $srcU = safe_url(str_field($r, 'source_url'), true); ?>
<figure class="card">
<blockquote><?= nl2br(e(str_field($r, 'quote')), false) ?></blockquote>
<?php if ($auth !== ''): ?><figcaption><cite><?= e($auth) ?></cite></figcaption><?php endif; ?>
<?php if ($srcU !== ''): ?><a class="src" href="<?= e($srcU) ?>" rel="noopener nofollow">Source</a><?php endif; ?>
</figure>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>

<?php if ($lat !== null || $address !== ''): ?>
<section class="map" aria-labelledby="map-h">
<h2 class="sec" id="map-h">Find us</h2>
<?php if ($lat !== null):
    $bbox = sprintf('%.6F,%.6F,%.6F,%.6F', $lng - 0.01, $lat - 0.006, $lng + 0.01, $lat + 0.006);
    $mk = sprintf('%.6F,%.6F', $lat, $lng);
    $osmSrc = 'https://www.openstreetmap.org/export/embed.html?bbox=' . rawurlencode($bbox) . '&layer=mapnik&marker=' . rawurlencode($mk);
    $osmBig = sprintf('https://www.openstreetmap.org/?mlat=%.6F&mlon=%.6F#map=16/%.6F/%.6F', $lat, $lng, $lat, $lng);
?>
<iframe src="<?= e($osmSrc) ?>" title="Map of <?= e($name) ?>" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
<p><a href="<?= e($osmBig) ?>" rel="noopener nofollow">Open larger map</a></p>
<?php else: ?>
<a class="btn" href="https://www.google.com/maps/search/?api=1&amp;query=<?= e(rawurlencode($address)) ?>" rel="noopener nofollow">View on Google Maps</a>
<?php endif; ?>
</section>
<?php endif; ?>

<?php if ($services): ?>
<section aria-labelledby="svc-h">
<h2 class="sec" id="svc-h">Services</h2>
<div class="grid">
<?php foreach ($services as $s):
    $title = $s; $descr = '';
    if (strpos($s, ' | ') !== false) {
        [$title, $descr] = array_map('trim', explode(' | ', $s, 2));
    } ?>
<div class="card"><h3><?= e($title) ?></h3><?php if ($descr !== ''): ?><p><?= e($descr) ?></p><?php endif; ?></div>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>

<?php
$postRows = [];
foreach ($posts as $p) {
    if (is_array($p) && str_field($p, 'body') !== '') $postRows[] = $p;
}
usort($postRows, function ($a, $b) {
    return (strtotime(str_field($b, 'created_at')) ?: 0) <=> (strtotime(str_field($a, 'created_at')) ?: 0);
});
?>
<?php if ($postRows): ?>
<section aria-labelledby="posts-h">
<h2 class="sec" id="posts-h">Latest from <?= e($name) ?></h2>
<?php foreach ($postRows as $p):
    $ts = strtotime(str_field($p, 'created_at'));
    $fu = safe_url(str_field($p, 'file_url'), true);
    $isImg = $fu !== '' && preg_match('/\.(png|jpe?g|gif|webp)$/i', (string)parse_url($fu, PHP_URL_PATH));
?>
<article class="card post">
<p><?= nl2br(e(str_field($p, 'body')), false) ?></p>
<?php if ($isImg): ?><img src="<?= e($fu) ?>" alt="" loading="lazy"><?php endif; ?>
<?php if ($ts): ?><p><time datetime="<?= e(gmdate('c', $ts)) ?>"><?= e(rel_time($ts)) ?> &middot; <?= e(gmdate('F j, Y', $ts)) ?></time></p><?php endif; ?>
</article>
<?php endforeach; ?>
<p class="muted">Posts from <?= e($name) ?> also appear in the Oasis19 community feed.</p>
</section>
<?php endif; ?>
</main>
<footer><div class="wrap">
<p>This page is part of Oasis19, a friendly interest-first community. No ads, no algorithm.</p>
<p><a href="https://oasis19.com/community/privacy.html">Privacy</a><a href="https://oasis19.com/community/terms.html">Terms</a><a href="https://oasis19.com/community/guidelines.html">Guidelines</a></p>
</div></footer>
</body>
</html>
