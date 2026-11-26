<?php
// Oasis19 public guides: /guides/ (index) and /guides/{slug}/ (set $GUIDE_SLUG in the stub index.php)
// Content lives in the public.guides table; only published rows come back from the database functions.
declare(strict_types=1);

const SB_BASE = 'https://qcsnxchphbtgumdazbpq.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc254Y2hwaGJ0Z3VtZGF6YnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzc0NDQsImV4cCI6MjEwODk1MzQ0NH0.9iTTsSe09SQR_I3RGaYWrPUv8wR3H0pGyYJIFc-abgQ';
const SITE    = 'https://oasis19.com';

function e($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function sf($arr, string $key): string
{
    return (is_array($arr) && isset($arr[$key]) && is_string($arr[$key])) ? trim($arr[$key]) : '';
}

function rpc(string $fn, array $args): array
{
    $ch = curl_init(SB_BASE . '/rest/v1/rpc/' . $fn);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode((object)$args),
        CURLOPT_HTTPHEADER     => ['apikey: ' . SB_KEY, 'Authorization: Bearer ' . SB_KEY, 'Content-Type: application/json', 'Accept: application/json'],
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

function msg(int $code, string $title, string $text): void
{
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    header($code === 503 ? 'Cache-Control: no-store' : 'Cache-Control: public, max-age=300');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . e($title) . ' | Oasis19</title><meta name="robots" content="noindex">'
        . '<style>body{font-family:"DM Sans",system-ui,sans-serif;background:#faf9fd;color:#1d1b2e;margin:0;padding:48px 20px;text-align:center}a{color:#3D1F8C}h1{color:#3D1F8C}</style></head><body><main><h1>' . e($title) . '</h1><p>' . e($text) . '</p><p><a href="/guides/">Oasis19 guides</a> | <a href="/">Home</a></p></main></body></html>';
    exit;
}

// Inline text: escape first, then allow [text](https://...) and [text](/path) links only.
function inline_md(string $s): string
{
    $s = e($s);
    return (string)preg_replace_callback('/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{4,300}|\/[A-Za-z0-9\-_\/.#]{0,200})\)/u', function ($m) {
        $href = $m[2];
        $ext  = strpos($href, 'https://') === 0 && strpos($href, 'https://oasis19.com') !== 0;
        return '<a href="' . $href . '"' . ($ext ? ' rel="noopener nofollow" target="_blank"' : '') . '>' . $m[1] . '</a>';
    }, $s);
}

function plain_md(string $s): string
{
    return trim((string)preg_replace('/\[([^\]]+)\]\([^)]+\)/u', '$1', $s));
}

function layout_open(string $title, string $desc, string $canonical, string $jsonld): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: public, max-age=300');
    header('X-Content-Type-Options: nosniff');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . e($title) . '</title><meta name="description" content="' . e($desc) . '"><link rel="canonical" href="' . e($canonical) . '">'
        . '<meta property="og:type" content="article"><meta property="og:site_name" content="Oasis19"><meta property="og:title" content="' . e($title) . '"><meta property="og:description" content="' . e($desc) . '"><meta property="og:url" content="' . e($canonical) . '">'
        . '<meta name="theme-color" content="#3D1F8C"><link rel="icon" href="/community/icon-192.png">'
        . '<style>'
        . 'body{font-family:"DM Sans",system-ui,-apple-system,Segoe UI,sans-serif;background:#faf9fd;color:#1d1b2e;margin:0;line-height:1.65}'
        . 'a{color:#3D1F8C}header.top{background:#3D1F8C;color:#fff;padding:14px 20px}header.top a{color:#fff;text-decoration:none;font-weight:700;font-size:1.15rem}'
        . 'nav.crumbs{max-width:760px;margin:18px auto 0;padding:0 20px;font-size:.9rem;color:#5b5873}'
        . 'main{max-width:760px;margin:0 auto;padding:10px 20px 40px}h1{color:#3D1F8C;line-height:1.2;font-size:2rem;margin:.6em 0 .5em}'
        . 'h2{color:#2a1566;margin:1.6em 0 .4em;font-size:1.35rem}h3{margin:1.2em 0 .2em;font-size:1.05rem}p{margin:.7em 0}ul{padding-left:1.2em}'
        . '.cta{background:#fff;border:1px solid #e3def5;border-radius:14px;padding:18px 20px;margin:32px 0}.cta a.btn{display:inline-block;background:#3D1F8C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;margin-top:6px}'
        . '.src{font-size:.88rem;color:#5b5873;word-break:break-word}footer{max-width:760px;margin:0 auto;padding:0 20px 40px;font-size:.9rem;color:#5b5873}footer a{margin-right:12px}'
        . '</style>';
    if ($jsonld !== '') {
        echo '<script type="application/ld+json">' . $jsonld . '</script>';
    }
    echo '</head><body><header class="top"><a href="/">Oasis19</a></header>';
}

function layout_close(): void
{
    echo '<footer><p><a href="/">Home</a><a href="/oasis/">Oasis directory</a><a href="/businesses">Businesses</a><a href="/guides/">Guides</a><a href="/community/">Open the community</a></p></footer></body></html>';
}

$slug = (isset($GUIDE_SLUG) && is_string($GUIDE_SLUG) && preg_match('/^[a-z0-9-]{3,80}$/', $GUIDE_SLUG)) ? $GUIDE_SLUG : '';

if ($slug === '') {
    // Index page
    $r = rpc('public_guides', []);
    if (!$r['ok']) {
        msg(503, 'Temporarily unavailable', 'The guides could not be loaded right now. Please try again in a few minutes.');
    }
    $rows = is_array($r['data']) ? $r['data'] : [];
    layout_open('Oasis19 guides: ad-free social media, privacy and online communities', 'Plain-language guides from Oasis19 on ad-free social media, privacy, interest communities and new social sites.', SITE . '/guides/', '');
    echo '<nav class="crumbs"><a href="/">Home</a> / Guides</nav><main><h1>Oasis19 guides</h1><p>Short, plain-language guides about how Oasis19 works and how it compares with other places to spend time online.</p><ul>';
    foreach ($rows as $row) {
        $s = sf($row, 'slug');
        if (!preg_match('/^[a-z0-9-]{3,80}$/', $s)) continue;
        echo '<li><p><a href="/guides/' . e($s) . '/">' . e(sf($row, 'title')) . '</a><br>' . e(sf($row, 'meta_description')) . '</p></li>';
    }
    echo '</ul></main>';
    layout_close();
    exit;
}

$r = rpc('public_guide', ['p_slug' => $slug]);
if (!$r['ok']) {
    msg(503, 'Temporarily unavailable', 'This guide could not be loaded right now. Please try again in a few minutes.');
}
$g = $r['data'];
if (!is_array($g) || sf($g, 'body_md') === '') {
    msg(404, 'Guide not found', 'We could not find that guide.');
}

$canonical = SITE . '/guides/' . $slug . '/';
$h1    = sf($g, 'h1');
$seo   = sf($g, 'seo_title');
$desc  = sf($g, 'meta_description');
$upd   = strtotime(sf($g, 'updated_at')) ?: time();
$lines = preg_split('/\R/u', sf($g, 'body_md')) ?: [];

// Parse blocks
$html = '';
$faqs = [];
$para = [];
$inList = false;
$curQ = null; $curA = [];
$flushPara = function () use (&$para, &$html, &$curQ, &$curA) {
    if ($para) {
        $text = implode(' ', $para);
        $html .= '<p>' . inline_md($text) . '</p>';
        if ($curQ !== null) { $curA[] = plain_md($text); }
        $para = [];
    }
};
$closeList = function () use (&$inList, &$html) { if ($inList) { $html .= '</ul>'; $inList = false; } };
$closeFaq = function () use (&$curQ, &$curA, &$faqs) {
    if ($curQ !== null && $curA) { $faqs[] = ['q' => $curQ, 'a' => implode(' ', $curA)]; }
    $curQ = null; $curA = [];
};
foreach ($lines as $ln) {
    $t = rtrim($ln);
    if (trim($t) === '') { $flushPara(); $closeList(); continue; }
    if (strpos($t, '### ') === 0) {
        $flushPara(); $closeList(); $closeFaq();
        $q = trim(substr($t, 4));
        $html .= '<h3>' . inline_md($q) . '</h3>';
        $curQ = plain_md($q);
        continue;
    }
    if (strpos($t, '## ') === 0) {
        $flushPara(); $closeList(); $closeFaq();
        $html .= '<h2>' . inline_md(trim(substr($t, 3))) . '</h2>';
        continue;
    }
    if (strpos($t, '- ') === 0) {
        $flushPara();
        if (!$inList) { $html .= '<ul>'; $inList = true; }
        $html .= '<li>' . inline_md(trim(substr($t, 2))) . '</li>';
        continue;
    }
    $closeList();
    $para[] = trim($t);
}
$flushPara(); $closeList(); $closeFaq();

$ld = [
    '@context' => 'https://schema.org',
    '@graph' => [[
        '@type' => 'Article',
        'headline' => $h1,
        'description' => $desc,
        'mainEntityOfPage' => $canonical,
        'dateModified' => gmdate('c', $upd),
        'author' => ['@type' => 'Person', 'name' => 'Bob Peryea'],
        'publisher' => ['@type' => 'Organization', 'name' => 'Oasis19', 'url' => SITE . '/'],
    ], [
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => SITE . '/'],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Guides', 'item' => SITE . '/guides/'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $h1, 'item' => $canonical],
        ],
    ]],
];
if ($faqs) {
    $ents = [];
    foreach ($faqs as $f) {
        $ents[] = ['@type' => 'Question', 'name' => $f['q'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']]];
    }
    $ld['@graph'][] = ['@type' => 'FAQPage', 'mainEntity' => $ents];
}

layout_open($seo, $desc, $canonical, json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
echo '<nav class="crumbs"><a href="/">Home</a> / <a href="/guides/">Guides</a> / ' . e($h1) . '</nav><main><h1>' . e($h1) . '</h1>' . $html;

$src = sf($g, 'sources');
if ($src !== '') {
    echo '<h2>Sources</h2><ul class="src">';
    foreach (preg_split('/\R/u', $src) ?: [] as $sl) {
        $sl = trim($sl);
        if ($sl === '') continue;
        if (preg_match('/^(.*?):\s*(https:\/\/\S+)$/u', $sl, $m)) {
            echo '<li>' . e($m[1]) . ': <a href="' . e($m[2]) . '" rel="noopener nofollow" target="_blank">' . e($m[2]) . '</a></li>';
        } else {
            echo '<li>' . e($sl) . '</li>';
        }
    }
    echo '</ul>';
}
echo '<div class="cta"><strong>Take a look around</strong><br>Browse the <a href="/oasis/">oasis directory</a> to see the topics, then open the community when you find one you like.<br><a class="btn" href="/community/">Open Oasis19</a></div></main>';
layout_close();
