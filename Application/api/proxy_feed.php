<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: public, max-age=300');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$feedUrl = filter_input(INPUT_GET, 'url', FILTER_VALIDATE_URL);
if (!$feedUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid feed URL required']);
    exit;
}

$config = require __DIR__ . '/../config/config.php';
$botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Proxy/1.0 (+https://agendaweb.app)';

$ctx = stream_context_create([
    'http' => [
        'timeout'    => 8,
        'user_agent' => $botUserAgent,
        'follow_location' => 1,
        'max_redirects'   => 3
    ]
]);

$xmlString = @file_get_contents($feedUrl, false, $ctx);
if ($xmlString === false) {
    http_response_code(422);
    echo json_encode(['error' => 'Unable to fetch remote feed']);
    exit;
}

libxml_use_internal_errors(true);
$xml = @simplexml_load_string($xmlString);
if (!$xml) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid RSS or Atom XML']);
    exit;
}

$title = (string)($xml->channel->title ?? $xml->title ?? 'Custom Feed');
$description = (string)($xml->channel->description ?? $xml->subtitle ?? '');

$items = [];
$categoriesFound = [];

// Handle RSS 2.0 or Atom
$xmlItems = isset($xml->channel->item) ? $xml->channel->item : ($xml->entry ?? []);
$count = 0;

foreach ($xmlItems as $item) {
    if ($count++ >= 30) break;

    $itemTitle = trim((string)$item->title);
    $itemLink  = (string)($item->link['href'] ?? $item->link);
    $rawDesc   = (string)($item->description ?? $item->summary ?? $item->content ?? '');
    $itemDate  = (string)($item->pubDate ?? $item->updated ?? date('r'));

    // Extract Category from <category> tag
    $itemCat = 'General';
    if (isset($item->category)) {
        $itemCat = trim((string)$item->category);
    }
    if (!empty($itemCat)) {
        $categoriesFound[] = $itemCat;
    }

    // Extract image from enclosure or media:content or <img> in description
    $imageUrl = null;
    if (isset($item->enclosure)) {
        $encType = (string)$item->enclosure['type'];
        if (str_starts_with($encType, 'image/')) {
            $imageUrl = (string)$item->enclosure['url'];
        }
    }
    
    $namespaces = $item->getNameSpaces(true);
    $fullContent = null;
    if (isset($namespaces['content'])) {
        $contentNs = $item->children($namespaces['content']);
        if (isset($contentNs->encoded)) {
            $fullContent = (string)$contentNs->encoded;
        }
    }
    if (!$fullContent && isset($item->content)) {
        $fullContent = (string)$item->content;
    }
    if (!$fullContent) {
        $fullContent = $rawDesc;
    }

    // Check media:content namespace if no enclosure image
    if (!$imageUrl) {
        if (isset($namespaces['media'])) {
            $media = $item->children($namespaces['media']);
            if (isset($media->content) && isset($media->content->attributes()->url)) {
                $imageUrl = (string)$media->content->attributes()->url;
            } elseif (isset($media->thumbnail) && isset($media->thumbnail->attributes()->url)) {
                $imageUrl = (string)$media->thumbnail->attributes()->url;
            }
        }
    }

    // Fallback: check <img> tag in HTML description
    if (!$imageUrl && preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $fullContent ?: $rawDesc, $match)) {
        $imageUrl = $match[1];
    }

    $summary = strip_tags($rawDesc);
    if (mb_strlen($summary) > 300) {
        $summary = mb_substr($summary, 0, 300) . '...';
    }

    $items[] = [
        'title'        => $itemTitle,
        'link'         => $itemLink,
        'summary'      => $summary,
        'content'      => $fullContent,
        'category'     => $itemCat ?: 'General',
        'image_url'    => $imageUrl,
        'published_at' => date('Y-m-d H:i:s', strtotime($itemDate))
    ];
}

$categories = array_values(array_unique(array_merge(['All'], array_filter($categoriesFound))));

echo json_encode([
    'status'      => 'success',
    'feed_url'    => $feedUrl,
    'title'       => $title,
    'description' => $description,
    'count'       => count($items),
    'categories'  => $categories,
    'items'       => $items
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
