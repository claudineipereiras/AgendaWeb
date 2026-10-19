<?php
declare(strict_types=1);

require_once __DIR__ . '/src/Database.php';

use AgendaWeb\Database;

set_time_limit(300);

$config = require __DIR__ . '/config/config.php';
$botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0';

try {
    $pdo = Database::getConnection();
} catch (\Throwable $e) {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "Database connection error: " . $e->getMessage() . "\n");
    }
    exit(1);
}

function runAllSync(PDO $pdo, string $botUserAgent): array {
    $sources = $pdo->query("SELECT * FROM sources WHERE is_active = 1")->fetchAll();
    $report = ['total' => count($sources), 'success' => 0, 'failed' => 0, 'details' => []];

    foreach ($sources as $source) {
        $count = 0;
        try {
            if ($source['type'] === 'rss') {
                $count = syncRss($pdo, $source, $botUserAgent);
            } elseif ($source['type'] === 'scrape_event') {
                $count = syncSchemaOrgEvents($pdo, $source, $botUserAgent);
            }
            $pdo->prepare("
                UPDATE sources 
                SET last_polled_at = NOW(), last_status = 'updated', http_code = 200, item_count = ?, last_error = NULL 
                WHERE id = ?
            ")->execute([$count, $source['id']]);
            $report['success']++;
            $report['details'][] = ['id' => $source['id'], 'name' => $source['name'], 'status' => 'updated', 'count' => $count];
        } catch (\Throwable $e) {
            $report['failed']++;
            $errMsg = mb_substr($e->getMessage(), 0, 250);
            $pdo->prepare("
                UPDATE sources 
                SET last_polled_at = NOW(), last_status = 'failed', last_error = ? 
                WHERE id = ?
            ")->execute([$errMsg, $source['id']]);
            $report['details'][] = ['id' => $source['id'], 'name' => $source['name'], 'status' => 'failed', 'error' => $errMsg];
        }
    }
    return $report;
}

if (php_sapi_name() === 'cli' || (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))) {
    $report = runAllSync($pdo, $botUserAgent);
    echo "Sync Complete: {$report['success']} succeeded, {$report['failed']} failed.\n";
}

function syncRss(PDO $pdo, array $source, string $userAgent): int {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'user_agent' => $userAgent]]);
    $xmlData = @file_get_contents($source['url'], false, $ctx);
    if (!$xmlData) return 0;

    $xml = @simplexml_load_string($xmlData);
    if (!$xml) return 0;

    $stmt = $pdo->prepare("
        INSERT INTO items (source_id, category_tab, category, title, link, summary, content, image_url, published_at)
        VALUES (:sid, :tab, :cat, :title, :link, :summary, :content, :image, :pub_date)
        ON DUPLICATE KEY UPDATE 
            summary = VALUES(summary),
            content = VALUES(content),
            image_url = IF(image_url IS NULL, VALUES(image_url), image_url)
    ");

    $items = isset($xml->channel->item) ? $xml->channel->item : ($xml->entry ?? []);
    $count = 0;
    foreach ($items as $item) {
        if ($count >= 30) break;
        $title = trim((string)$item->title);
        $link  = (string)($item->link['href'] ?? $item->link);
        $rawDesc = (string)($item->description ?? $item->summary ?? '');
        $date  = (string)($item->pubDate ?? $item->updated ?? date('r'));

        // Extract full content (<content:encoded> or <content>)
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

        // Extract category tag
        $cat = 'General';
        if (isset($item->category)) {
            $cat = trim((string)$item->category);
        }

        // Extract image
        $imageUrl = null;
        if (isset($item->enclosure)) {
            $encType = (string)$item->enclosure['type'];
            if (str_starts_with($encType, 'image/')) {
                $imageUrl = (string)$item->enclosure['url'];
            }
        }
        if (!$imageUrl) {
            if (isset($namespaces['media'])) {
                $media = $item->children($namespaces['media']);
                if (isset($media->content) && isset($media->content->attributes()->url)) {
                    $imageUrl = (string)$media->content->attributes()->url;
                }
            }
        }
        if (!$imageUrl && preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $fullContent ?: $rawDesc, $match)) {
            $imageUrl = $match[1];
        }

        $desc = strip_tags($rawDesc);

        $stmt->execute([
            'sid'      => $source['id'],
            'tab'      => $source['category_tab'],
            'cat'      => $cat ?: 'General',
            'title'    => $title,
            'link'     => $link,
            'summary'  => mb_substr($desc, 0, 300) . '...',
            'content'  => $fullContent,
            'image'    => $imageUrl,
            'pub_date' => date('Y-m-d H:i:s', strtotime($date))
        ]);
        $count++;
    }
    return $count;
}

function syncSchemaOrgEvents(PDO $pdo, array $source, string $userAgent): int {
    $ctx = stream_context_create(['http' => ['timeout' => 12, 'user_agent' => $userAgent]]);
    $html = @file_get_contents($source['url'], false, $ctx);
    if (!$html) return 0;

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);
    $scripts = $xpath->query('//script[@type="application/ld+json"]');

    // Only update if origin is 'scraped' to protect manual venue updates
    $stmt = $pdo->prepare("
        INSERT INTO events (venue_slug, title, description, category, start_time, end_time, venue_name, address, ticket_url, image_url, origin)
        VALUES (:slug, :title, :description, :cat, :start, :end, :vname, :addr, :turl, :image, 'scraped')
        ON DUPLICATE KEY UPDATE 
            description = IF(origin = 'manual', description, VALUES(description)),
            ticket_url = IF(origin = 'manual', ticket_url, VALUES(ticket_url)),
            end_time = IF(origin = 'manual', end_time, VALUES(end_time)),
            image_url = IF(origin = 'manual', image_url, VALUES(image_url))
    ");

    $count = 0;
    foreach ($scripts as $s) {
        $data = json_decode(trim($s->nodeValue), true);
        if (!is_array($data)) continue;

        $nodes = isset($data['@graph']) ? $data['@graph'] : ($data[0] ? $data : [$data]);
        foreach ($nodes as $node) {
            $type = $node['@type'] ?? '';
            if (is_string($type) && (str_ends_with($type, 'Event') || $type === 'Event')) {
                if (empty($node['name']) || empty($node['startDate'])) continue;

                $start = date('Y-m-d H:i:s', strtotime($node['startDate']));
                if (strtotime($start) < time()) continue;

                // Extract image from schema.org
                $imageUrl = null;
                if (!empty($node['image'])) {
                    $imageUrl = is_array($node['image']) ? ($node['image'][0] ?? ($node['image']['url'] ?? null)) : (string)$node['image'];
                }

                $stmt->execute([
                    'slug'        => $source['slug'],
                    'title'       => trim($node['name']),
                    'description' => strip_tags($node['description'] ?? ''),
                    'cat'         => str_replace('Event', '', (string)$type) ?: 'Culture',
                    'start'       => $start,
                    'end'         => !empty($node['endDate']) ? date('Y-m-d H:i:s', strtotime($node['endDate'])) : null,
                    'vname'       => $node['location']['name'] ?? $source['name'],
                    'addr'        => is_array($node['location']['address'] ?? null) ? ($node['location']['address']['streetAddress'] ?? '') : ($node['location']['address'] ?? ''),
                    'turl'        => $node['offers']['url'] ?? $node['url'] ?? $source['url'],
                    'image'       => $imageUrl
                ]);
                $count++;
            }
        }
    }
    return $count;
}