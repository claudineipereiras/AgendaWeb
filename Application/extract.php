<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$config = require __DIR__ . '/config/config.php';
$botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0 (+https://agendaweb.app)';

$targetUrl = filter_input(INPUT_GET, 'url', FILTER_VALIDATE_URL);
if (!$targetUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid URL required']);
    exit;
}

$ctx = stream_context_create([
    'http' => [
        'timeout'    => 6,
        'user_agent' => $botUserAgent
    ]
]);

$html = @file_get_contents($targetUrl, false, $ctx, 0, 65536);
if ($html === false) {
    http_response_code(422);
    echo json_encode(['error' => 'Unable to read target page']);
    exit;
}

libxml_use_internal_errors(true);
$dom = new DOMDocument();
@$dom->loadHTML($html);
libxml_clear_errors();

$xpath = new DOMXPath($dom);
$queryMeta = function(string $prop) use ($xpath): string {
    $node = $xpath->query("//meta[@property='{$prop}']/@content | //meta[@name='{$prop}']/@content");
    return ($node && $node->length > 0) ? trim($node->item(0)->nodeValue) : '';
};

$title = $queryMeta('og:title') ?: $queryMeta('twitter:title');
if (!$title) {
    $tNodes = $xpath->query('//title');
    $title = ($tNodes && $tNodes->length > 0) ? trim($tNodes->item(0)->nodeValue) : 'Untitled Link';
}

$description = $queryMeta('og:description') ?: $queryMeta('description');
$image       = $queryMeta('og:image');
$siteName    = $queryMeta('og:site_name') ?: parse_url($targetUrl, PHP_URL_HOST);

echo json_encode([
    'url'         => $targetUrl,
    'title'       => html_entity_decode($title, ENT_QUOTES, 'UTF-8'),
    'description' => html_entity_decode($description, ENT_QUOTES, 'UTF-8'),
    'image'       => $image,
    'domain'      => $siteName,
    'saved_at'    => gmdate('Y-m-d\TH:i:s\Z')
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);