<?php
// Oasis19 public post page: /p/{id} -> post.php?id={id}
// Only posts whose author ticked "Share this post with Google" in a public oasis are returned by the database function.
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

function rpc_id(string $fn, int $id): array
{
    $ch = curl_init(SB_BASE . '/rest/v1/rpc/' . $fn);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['p_id' => $id]),
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

function page_msg(int $code, string $title, string $msg): void
{
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    header($code === 503 ? 'Cache-Control: no-store' : 'Cache-Control: public, max-age=300');
    if ($code === 503) header('Retry-After: 120');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . e($title) . ' | Oasis19</title><meta name="robots" content="noindex">'
        . '<style>body{font-family:"DM Sans",system-ui,sans-serif;background:#faf9fd;color:#1d1b2e;margin:0;padding:48px 20px;text-align:center}a{color:#3D1F8C}h1{color:#3D1F8C}</style></head><body>'
        . '<main><h1>' . e($title) . '</h1><p>' . e($msg) . '</p><p><a href="https://oasis19.com/">Back to Oasis19</a></p></main></body></html>';
    exit;
}

header('X-Content-Type-Options: nosniff');

$id = isset($_GET['id']) && is_string($_GET['id']) && preg_match('/^[0-9]{1,12}$/', $_GET['id']) ? (int)$_GET['id'] : 0;
if ($id < 1) {
    page_msg(404, 'Post not found', 'We could not find that post. It may have been removed, or the author may have stopped sharing it publicly.');
}
$res = rpc_id('public_post', $id);
if (!$res['ok']) {
    page_msg(503, 'Temporarily unavailable', 'This post could not be loaded right now. Please try again in a few minutes.');
}
$p = $res['data'];
if (!is_array($p) || str_field($p, 'body') === '') {
    page_msg(404, 'Post not found', 'We could not find that post. It may have been removed, or the author may have stopped sharing it publicly.');
}

$body    = str_field($p, 'body');
$author  = str_field($p, 'author_name');
$oasis   = str_field($p, 'oasis_name');
$oSlug   = str_field($p, 'oasis_slug');
$ts      = strtotime(str_field($p, 'created_at')) ?: time();
$flat    = trim((string)preg_replace('/\s+/u', ' ', $body));
$lines   = preg_split('/\\R/u', trim($body)) ?: [];
$first   = trim((string)($lines[0] ?? ''));
if ($first !== '' && mb_strlen($first, 'UTF-8') <= 110 && count($lines) > 1) {
    $title = $first;
    $body  = trim(implode("\n", array_slice($lines, 1)));
} else {
    $title = cut($flat, 60);
    if (mb_strlen($flat, 'UTF-8') > 60) { $title = rtrim($title, " ,.;:-") . '...'; }
}
$desc    = cut(trim((string)preg_replace('/\\s+/u', ' ', $body)), 160);
$canonical = SITE . '/p/' . $id;
$oasisUrl  = preg_match('/^[a-z0-9-]{2,40}$/', $oSlug) ? SITE . '/oasis/' . $oSlug . '/' : SITE . '/oasis/';

$comments = [];
if (isset($p['comments']) && is_array($p['comments'])) {
    foreach ($p['comments'] as $c) {
        if (is_array($c) && str_field($c, 'body') !== '') $comments[] = $c;
        if (count($comments) >= 50) break;
    }
}

$ld = [
    '@context' => 'https://schema.org',
    '@type' => 'DiscussionForumPosting',
    '@id' => $canonical,
    'url' => $canonical,
    'headline' => cut($flat, 110),
    'text' => cut($body, 2000),
    'datePublished' => gmdate('c', $ts),
    'author' => ['@type' => 'Person', 'name' => $author !== '' ? $author : 'Oasis19 member'],
    'isPartOf' => ['@type' => 'WebSite', 'name' => 'Oasis19', 'url' => SITE . '/'],
    'interactionStatistic' => ['@type' => 'InteractionCounter', 'interactionType' => 'https://schema.org/CommentAction', 'userInteractionCount' => count($comments)],
];
if ($comments) {
    $ld['comment'] = [];
    foreach ($comments as $c) {
        $cts = strtotime(str_field($c, 'created_at'));
        $ld['comment'][] = ['@type' => 'Comment', 'text' => cut(str_field($c, 'body'), 1000),
            'author' => ['@type' => 'Person', 'name' => str_field($c, 'author_name') ?: 'Oasis19 member'],
            'datePublished' => $cts ? gmdate('c', $cts) : gmdate('c', $ts)];
    }
}
$ldJson = json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?> | <?= e($oasis) ?> | Oasis19</title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($canonical) ?>">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Oasis19">
<meta property="og:title" content="<?= e($title) ?> | Oasis19">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($canonical) ?>">
<meta property="og:image" content="<?= e(SITE) ?>/images/logo-v2.png">
<meta name="twitter:card" content="summary">
<script type="application/ld+json"><?= $ldJson ?></script>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#faf9fd;color:#1d1b2e;line-height:1.6}
a{color:#3D1F8C}
a:focus-visible{outline:3px solid #f08a24;outline-offset:2px}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
.topbar{background:#fff;border-bottom:1px solid #e6e2f2}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:48px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#3D1F8C;text-decoration:none}
.brand img{width:32px;height:32px}
main{padding:24px 0 8px}
.card{background:#fff;border:1px solid #e6e2f2;border-radius:14px;padding:24px;margin-bottom:18px}
.meta{color:#666;font-size:.9rem;margin:0 0 12px}
.post p{margin:0 0 12px;overflow-wrap:anywhere;font-size:1.05rem}
h1{color:#3D1F8C;font-size:1.3rem;margin:0 0 14px}
h2{color:#3D1F8C;font-size:1.15rem;margin:0 0 12px}
.notice{background:#fff7ec;border:1px solid #f3d3a6;border-radius:10px;padding:10px 14px;font-size:.9rem;margin-bottom:18px}
.comment{border-top:1px solid #eee;padding:12px 0}
.comment:first-of-type{border-top:0}
.comment p{margin:4px 0 0;overflow-wrap:anywhere}
.btn{display:inline-block;background:#3D1F8C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700}
footer{margin-top:28px;border-top:1px solid #e6e2f2;background:#fff;padding:22px 0;color:#666;font-size:.9rem}
footer a{margin-right:14px}
</style>
</head>
<body>
<header class="topbar"><div class="wrap">
<a class="brand" href="https://oasis19.com/"><img src="/images/logo-v2.png" width="32" height="32" alt=""><span>Oasis19</span></a>
<a href="https://oasis19.com/community/">Join the conversation</a>
</div></header>
<main class="wrap">
<p class="notice">The author chose to share this post with Google. Comments written after it was shared may be visible here too.</p>
<article class="card post">
<p class="meta"><?= e($author) ?> in <a href="<?= e($oasisUrl) ?>"><?= e($oasis) ?></a> &middot; <time datetime="<?= e(gmdate('c', $ts)) ?>"><?= e(gmdate('F j, Y', $ts)) ?></time></p>
<h1><?= e($title) ?></h1>
<?php foreach (preg_split('/\R\s*\R/u', $body) ?: [] as $para) { $para = trim($para); if ($para !== '') echo '<p>' . nl2br(e($para), false) . '</p>'; } ?>
</article>
<?php if ($comments): ?>
<section class="card" aria-labelledby="c-h">
<h2 id="c-h">Comments (<?= count($comments) ?>)</h2>
<?php foreach ($comments as $c): $cts = strtotime(str_field($c, 'created_at')); ?>
<div class="comment"><strong><?= e(str_field($c, 'author_name') ?: 'Oasis19 member') ?></strong><?php if ($cts): ?> <span class="meta"><?= e(rel_time($cts)) ?></span><?php endif; ?>
<p><?= nl2br(e(str_field($c, 'body')), false) ?></p></div>
<?php endforeach; ?>
</section>
<?php endif; ?>
<p><a class="btn" href="https://oasis19.com/community/">Join Oasis19 to reply</a></p>
</main>
<footer><div class="wrap">
<p>Oasis19 is a friendly, interest-first community. No ads, no algorithm. Members choose what they share with Google.</p>
<p><a href="https://oasis19.com/about.html">About</a><a href="https://oasis19.com/community/privacy.html">Privacy</a><a href="https://oasis19.com/community/terms.html">Terms</a><a href="https://oasis19.com/community/guidelines.html">Guidelines</a></p>
</div></footer>
</body>
</html>
