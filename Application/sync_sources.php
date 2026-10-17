<?php
declare(strict_types=1);
set_time_limit(300);

$pdo = new PDO(
    'mysql:host=localhost;dbname=u123456789_agenda;charset=utf8mb4',
    'u123456789_admin',
    'YourSecretPasswordHere',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$sources = $pdo->query("SELECT * FROM sources WHERE is_active = 1")->fetchAll(PDO::FETCH_ASSOC);

foreach ($sources as $source) {
    if ($source['type'] === 'rss') {
        syncRss($pdo, $source);
    } elseif ($source['type'] === 'scrape_event') {
        syncSchemaOrgEvents($pdo, $source);
    }
    $pdo->prepare("UPDATE sources SET last_polled_at = NOW() WHERE id = ?")->execute([$source['id']]);
}

function syncRss(PDO $pdo, array $source): void {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'user_agent' => 'AgendaWeb-Sync/1.0']]);
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
        if ($i++ > 20) break;
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

function syncSchemaOrgEvents(PDO $pdo, array $source): void {
    $ctx = stream_context_create(['http' => ['timeout' => 12, 'user_agent' => 'AgendaWeb-Bot/1.0']]);
    $html = @file_get_contents($source['url'], false, $ctx);
    if (!$html) return;

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);
    $scripts = $xpath->query('//script[@type="application/ld+json"]');

    $stmt = $pdo->prepare("
        INSERT INTO events (venue_slug, title, description, category, start_time, end_time, venue_name, address, ticket_url)
        VALUES (:slug, :title, :description, :cat, :start, :end, :vname, :addr, :turl)
        ON DUPLICATE KEY UPDATE description = VALUES(description), ticket_url = VALUES(ticket_url)
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