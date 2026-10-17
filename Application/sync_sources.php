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

$sources = $pdo->query("SELECT * FROM sources WHERE is_active = 1")->fetchAll();

foreach ($sources as $source) {
    if ($source['type'] === 'rss') {
        syncRss($pdo, $source, $botUserAgent);
    } elseif ($source['type'] === 'scrape_event') {
        syncSchemaOrgEvents($pdo, $source, $botUserAgent);
    }
    $pdo->prepare("UPDATE sources SET last_polled_at = NOW() WHERE id = ?")->execute([$source['id']]);
}

function syncRss(PDO $pdo, array $source, string $userAgent): void {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'user_agent' => $userAgent]]);
    $xmlData = @file_get_contents($source['url'], false, $ctx);
    if (!$xmlData) return;

    $xml = @simplexml_load_string($xmlData);
    if (!$xml) return;

    $stmt = $pdo->prepare("
        INSERT INTO items (source_id, category_tab, title, link, summary, published_at)
        VALUES (:sid, :tab, :title, :link, :summary, :pub_date)
        ON DUPLICATE KEY UPDATE summary = VALUES(summary)
    ");

    $items = isset($xml->channel->item) ? $xml->channel->item : ($xml->entry ?? []);
    $i = 0;
    foreach ($items as $item) {
        if ($i++ > 25) break;
        $title = (string)$item->title;
        $link  = (string)($item->link['href'] ?? $item->link);
        $desc  = strip_tags((string)($item->description ?? $item->summary ?? ''));
        $date  = (string)($item->pubDate ?? $item->updated ?? date('r'));

        $stmt->execute([
            'sid'      => $source['id'],
            'tab'      => $source['category_tab'],
            'title'    => $title,
            'link'     => $link,
            'summary'  => mb_substr($desc, 0, 300) . '...',
            'pub_date' => date('Y-m-d H:i:s', strtotime($date))
        ]);
    }
}

function syncSchemaOrgEvents(PDO $pdo, array $source, string $userAgent): void {
    $ctx = stream_context_create(['http' => ['timeout' => 12, 'user_agent' => $userAgent]]);
    $html = @file_get_contents($source['url'], false, $ctx);
    if (!$html) return;

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);
    $scripts = $xpath->query('//script[@type="application/ld+json"]');

    // Only update if origin is 'scraped' to protect manual venue updates
    $stmt = $pdo->prepare("
        INSERT INTO events (venue_slug, title, description, category, start_time, end_time, venue_name, address, ticket_url, origin)
        VALUES (:slug, :title, :description, :cat, :start, :end, :vname, :addr, :turl, 'scraped')
        ON DUPLICATE KEY UPDATE 
            description = IF(origin = 'manual', description, VALUES(description)),
            ticket_url = IF(origin = 'manual', ticket_url, VALUES(ticket_url)),
            end_time = IF(origin = 'manual', end_time, VALUES(end_time))
    ");

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

                $stmt->execute([
                    'slug'        => $source['slug'],
                    'title'       => trim($node['name']),
                    'description' => strip_tags($node['description'] ?? ''),
                    'cat'         => str_replace('Event', '', (string)$type) ?: 'Culture',
                    'start'       => $start,
                    'end'         => !empty($node['endDate']) ? date('Y-m-d H:i:s', strtotime($node['endDate'])) : null,
                    'vname'       => $node['location']['name'] ?? $source['name'],
                    'addr'        => is_array($node['location']['address'] ?? null) ? ($node['location']['address']['streetAddress'] ?? '') : ($node['location']['address'] ?? ''),
                    'turl'        => $node['offers']['url'] ?? $node['url'] ?? $source['url']
                ]);
            }
        }
    }
}