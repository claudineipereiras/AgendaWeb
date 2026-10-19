<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$config = require __DIR__ . '/../config/config.php';
$expectedKey = $config['app']['admin_key'] ?? 'agendaweb-admin-secret-2026';

// Verify Admin Key
$providedKey = $_SERVER['HTTP_X_ADMIN_KEY'] ?? ($_GET['key'] ?? '');
if (empty($providedKey) || !hash_equals($expectedKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Invalid Admin Key']);
    exit;
}

$action = filter_input(INPUT_GET, 'action', FILTER_DEFAULT) ?? 'stats';

try {
    $pdo = Database::getConnection();

    // 1. Stats Overview
    if ($action === 'stats') {
        $sourceCount = (int)$pdo->query("SELECT COUNT(*) FROM sources")->fetchColumn();
        $activeSourceCount = (int)$pdo->query("SELECT COUNT(*) FROM sources WHERE is_active = 1")->fetchColumn();
        $eventCount  = (int)$pdo->query("SELECT COUNT(*) FROM events")->fetchColumn();
        $itemCount   = (int)$pdo->query("SELECT COUNT(*) FROM items")->fetchColumn();
        $newSuggestions = (int)$pdo->query("SELECT COUNT(*) FROM suggestions WHERE status = 'new'")->fetchColumn();

        echo json_encode([
            'status' => 'success',
            'data'   => [
                'total_sources'    => $sourceCount,
                'active_sources'   => $activeSourceCount,
                'total_events'     => $eventCount,
                'total_items'      => $itemCount,
                'new_suggestions'  => $newSuggestions
            ]
        ]);
        exit;
    }

    // 2. Curated Sources List (with Health & Status)
    if ($action === 'sources') {
        $stmt = $pdo->query("SELECT id, slug, name, type, url, category_tab, is_active, last_polled_at, last_status, http_code, last_error, item_count, contact_email, submission_notes FROM sources ORDER BY (is_active = 0 AND last_status = 'pending') DESC, category_tab ASC, name ASC");
        $sources = $stmt->fetchAll();

        echo json_encode([
            'status' => 'success',
            'count'  => count($sources),
            'data'   => $sources
        ]);
        exit;
    }

    // 2.1 Automated URL Scrape & Event Discovery Preview
    if ($action === 'scrape_preview') {
        $targetUrl = trim((string)($_GET['url'] ?? ($_POST['url'] ?? '')));
        if (!$targetUrl || !filter_var($targetUrl, FILTER_VALIDATE_URL)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Valid website URL required']);
            exit;
        }

        $botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0 (+https://agendaweb.app)';
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 12,
                'user_agent' => $botUserAgent,
                'follow_location' => 1,
                'max_redirects' => 4,
                'ignore_errors' => true
            ]
        ]);

        $html = @file_get_contents($targetUrl, false, $ctx);
        $httpCode = 200;
        if (isset($http_response_header[0]) && preg_match('{HTTP\/\S*\s(\d{3})}', $http_response_header[0], $m)) {
            $httpCode = (int)$m[1];
        }

        if (!$html || $httpCode >= 400) {
            http_response_code(422);
            echo json_encode([
                'status' => 'error',
                'message' => "Unable to fetch webpage (HTTP $httpCode)",
                'http_code' => $httpCode
            ]);
            exit;
        }

        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        @$dom->loadHTML($html);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);

        // Extract Title
        $titleNode = $xpath->query('//title')->item(0);
        $pageTitle = $titleNode ? trim($titleNode->textContent) : '';

        // Extract RSS / Atom alternate links
        $feedLinks = $xpath->query('//link[@rel="alternate" and (@type="application/rss+xml" or @type="application/atom+xml")]');
        $discoveredFeed = null;
        if ($feedLinks->length > 0) {
            $discoveredFeed = $feedLinks->item(0)->getAttribute('href');
            if ($discoveredFeed && !filter_var($discoveredFeed, FILTER_VALIDATE_URL)) {
                $base = rtrim($targetUrl, '/');
                $discoveredFeed = $base . '/' . ltrim($discoveredFeed, '/');
            }
        }

        // Extract Schema.org/Event JSON-LD
        $scripts = $xpath->query('//script[@type="application/ld+json"]');
        $events = [];
        $detectedVenue = '';

        foreach ($scripts as $s) {
            $data = json_decode(trim($s->nodeValue), true);
            if (!is_array($data)) continue;

            $nodes = isset($data['@graph']) ? $data['@graph'] : ($data[0] ? $data : [$data]);
            foreach ($nodes as $node) {
                $type = $node['@type'] ?? '';
                if (is_string($type) && (str_ends_with($type, 'Event') || $type === 'Event')) {
                    if (empty($node['name']) || empty($node['startDate'])) continue;

                    $venueName = $node['location']['name'] ?? '';
                    if ($venueName && !$detectedVenue) $detectedVenue = $venueName;

                    $events[] = [
                        'title'       => trim($node['name']),
                        'description' => strip_tags($node['description'] ?? ''),
                        'start_time'  => date('Y-m-d H:i:s', strtotime($node['startDate'])),
                        'end_time'    => !empty($node['endDate']) ? date('Y-m-d H:i:s', strtotime($node['endDate'])) : null,
                        'category'    => str_replace('Event', '', (string)$type) ?: 'Live Music',
                        'venue_name'  => $venueName,
                        'address'     => is_array($node['location']['address'] ?? null) ? ($node['location']['address']['streetAddress'] ?? '') : ($node['location']['address'] ?? ''),
                        'ticket_url'  => $node['offers']['url'] ?? $node['url'] ?? $targetUrl,
                        'image_url'   => is_array($node['image'] ?? null) ? ($node['image'][0] ?? null) : ($node['image'] ?? null)
                    ];
                }
            }
        }

        $detectedType = count($events) > 0 ? 'scrape_event' : ($discoveredFeed ? 'rss' : 'scrape_event');
        $suggestedName = $detectedVenue ?: preg_replace('/(\s*[-|–]\s*.*)$/i', '', $pageTitle);
        $suggestedName = trim($suggestedName) ?: parse_url($targetUrl, PHP_URL_HOST);
        $venueSlug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($suggestedName));
        $venueSlug = trim($venueSlug, '-') ?: 'venue-' . time();

        $venueAddress = '';
        if (count($events) > 0 && !empty($events[0]['address'])) {
            $venueAddress = $events[0]['address'];
        }

        echo json_encode([
            'status'         => 'success',
            'url'            => $targetUrl,
            'http_code'      => $httpCode,
            'page_title'     => $pageTitle,
            'detected_type'  => $detectedType,
            'suggested_name' => $suggestedName,
            'suggested_tab'  => count($events) > 0 ? 'events' : ($discoveredFeed ? 'blogs' : 'events'),
            'feed_url'       => $discoveredFeed,
            'events_count'   => count($events),
            'venue'          => [
                'slug'        => $venueSlug,
                'name'        => $suggestedName,
                'address'     => $venueAddress,
                'website_url' => $targetUrl,
                'feed_url'    => $discoveredFeed
            ],
            'events'         => array_slice($events, 0, 8)
        ]);
        exit;
    }

    // 3. Add Curated Source
    if ($action === 'add_source' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;

        $name = trim((string)($data['name'] ?? ''));
        $url  = trim((string)($data['url'] ?? ''));
        $tab  = trim((string)($data['category_tab'] ?? 'blogs'));
        $type = trim((string)($data['type'] ?? 'rss'));

        if (!$name || !$url) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Name and URL are required']);
            exit;
        }

        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($name));
        $slug = trim($slug, '-') ?: ('source-' . time());

        $stmt = $pdo->prepare("
            INSERT INTO sources (slug, name, type, url, category_tab, is_active)
            VALUES (:slug, :name, :type, :url, :tab, 1)
        ");
        $stmt->execute([
            'slug' => $slug,
            'name' => $name,
            'type' => $type,
            'url'  => $url,
            'tab'  => $tab
        ]);
        $newSourceId = (int)$pdo->lastInsertId();

        // If this is an event venue source, automatically register or update the venues database table
        if ($tab === 'events' || $type === 'scrape_event' || !empty($data['is_venue'])) {
            try {
                $vstmt = $pdo->prepare("
                    INSERT INTO venues (slug, name, address, website_url, feed_url, source_id)
                    VALUES (:slug, :name, :address, :web, :feed, :sid)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        address = IF(VALUES(address) != '', VALUES(address), address),
                        website_url = VALUES(website_url),
                        feed_url = IF(VALUES(feed_url) IS NOT NULL, VALUES(feed_url), feed_url),
                        source_id = VALUES(source_id)
                ");
                $vstmt->execute([
                    'slug'    => $slug,
                    'name'    => $name,
                    'address' => trim((string)($data['address'] ?? '')),
                    'web'     => $url,
                    'feed'    => !empty($data['feed_url']) ? $data['feed_url'] : null,
                    'sid'     => $newSourceId
                ]);
            } catch (\Throwable $ve) {
                // Non-fatal if venues table not migrated
            }
        }

        echo json_encode([
            'status'  => 'success',
            'message' => "Source '$name' added successfully" . (($tab === 'events' || $type === 'scrape_event') ? " and venue database updated" : ""),
            'id'      => $newSourceId
        ]);
        exit;
    }

    // 4. Toggle Source Active
    if ($action === 'toggle_source' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $id = (int)($data['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Source ID required']);
            exit;
        }

        $pdo->prepare("UPDATE sources SET is_active = IF(is_active = 1, 0, 1) WHERE id = :id")->execute(['id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Source status toggled']);
        exit;
    }

    // 4.1 Approve & Activate Venue Source (Moderation Queue)
    if ($action === 'approve_source' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $id = (int)($data['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Source ID required']);
            exit;
        }

        // Activate source in sources table
        $pdo->prepare("UPDATE sources SET is_active = 1, last_status = 'active' WHERE id = :id")->execute(['id' => $id]);
        // Activate linked venue in venues table
        try {
            $pdo->prepare("UPDATE venues SET is_active = 1 WHERE source_id = :id")->execute(['id' => $id]);
        } catch (\Throwable $ve) {}

        // Fetch source info
        $stmt = $pdo->prepare("SELECT * FROM sources WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $src = $stmt->fetch();

        $count = 0;
        if ($src) {
            require_once __DIR__ . '/../sync_sources.php';
            $botAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0 (+https://agendaweb.app)';
            try {
                if ($src['type'] === 'scrape_event') {
                    $count = syncSchemaOrgEvents($pdo, $src, $botAgent);
                } else {
                    $count = syncRss($pdo, $src, $botAgent);
                }
                $pdo->prepare("UPDATE sources SET item_count = :count, last_polled_at = NOW(), last_status = 'updated' WHERE id = :id")
                    ->execute(['count' => $count, 'id' => $id]);
            } catch (\Throwable $se) {}
        }

        echo json_encode([
            'status'     => 'success',
            'message'    => "Venue '{$src['name']}' approved, activated, and initial scrape complete!",
            'item_count' => $count
        ]);
        exit;
    }

    // 5. Delete Source
    if ($action === 'delete_source' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $id = (int)($data['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Source ID required']);
            exit;
        }

        $pdo->prepare("DELETE FROM sources WHERE id = :id")->execute(['id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Source deleted']);
        exit;
    }

    // 6. Suggestions List
    if ($action === 'suggestions') {
        $status = filter_input(INPUT_GET, 'status', FILTER_DEFAULT) ?? 'all';
        $where = [];
        $params = [];

        if ($status !== 'all') {
            $where[] = "status = :status";
            $params['status'] = $status;
        }
        $whereSql = !empty($where) ? "WHERE " . implode(' AND ', $where) : "";

        $stmt = $pdo->prepare("SELECT id, name, email, category, message, status, created_at FROM suggestions {$whereSql} ORDER BY created_at DESC");
        $stmt->execute($params);
        $suggestions = $stmt->fetchAll();

        echo json_encode([
            'status' => 'success',
            'count'  => count($suggestions),
            'data'   => $suggestions
        ]);
        exit;
    }

    // 7. Update Suggestion Status
    if ($action === 'update_suggestion' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $id = (int)($data['id'] ?? 0);
        $status = trim((string)($data['status'] ?? 'read'));

        if (!$id || !in_array($status, ['new', 'read', 'archived'], true)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Valid ID and status required']);
            exit;
        }

        $pdo->prepare("UPDATE suggestions SET status = :status WHERE id = :id")->execute(['status' => $status, 'id' => $id]);
        echo json_encode(['status' => 'success', 'message' => "Suggestion marked as $status"]);
        exit;
    }

    // 8. Delete Suggestion
    if ($action === 'delete_suggestion' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $id = (int)($data['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Suggestion ID required']);
            exit;
        }

        $pdo->prepare("DELETE FROM suggestions WHERE id = :id")->execute(['id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Suggestion deleted']);
        exit;
    }

    // 8.1 Trigger Single Source Sync
    if ($action === 'sync_single' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $id = (int)($data['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Source ID required']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM sources WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $source = $stmt->fetch();

        if (!$source) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Source not found']);
            exit;
        }

        require_once __DIR__ . '/../sync_sources.php';
        $botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0';

        $syncCount = 0;
        $lastStatus = 'updated';
        $lastError = null;

        try {
            if ($source['type'] === 'rss') {
                $syncCount = syncRss($pdo, $source, $botUserAgent);
            } else {
                $syncCount = syncSchemaOrgEvents($pdo, $source, $botUserAgent);
            }
            $pdo->prepare("
                UPDATE sources 
                SET last_polled_at = NOW(), last_status = 'updated', http_code = 200, item_count = :cnt, last_error = NULL 
                WHERE id = :id
            ")->execute(['cnt' => $syncCount, 'id' => $id]);
        } catch (\Throwable $err) {
            $lastStatus = 'failed';
            $lastError = mb_substr($err->getMessage(), 0, 250);
            $pdo->prepare("
                UPDATE sources 
                SET last_polled_at = NOW(), last_status = 'failed', last_error = :err 
                WHERE id = :id
            ")->execute(['err' => $lastError, 'id' => $id]);
        }

        echo json_encode([
            'status'        => 'success',
            'source_id'     => $id,
            'name'          => $source['name'],
            'last_status'   => $lastStatus,
            'item_count'    => $syncCount,
            'last_error'    => $lastError,
            'last_polled_at'=> date('Y-m-d H:i:s')
        ]);
        exit;
    }

    // 9. Trigger Ingestion Sync Now (All Active Sources)
    if ($action === 'sync_now' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        require_once __DIR__ . '/../sync_sources.php';
        $botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0';
        $report = runAllSync($pdo, $botUserAgent);

        echo json_encode([
            'status'  => 'success',
            'message' => 'Full sync executed',
            'report'  => $report
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => "Unknown action: $action"]);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Admin operation failed: ' . $e->getMessage()
    ]);
}
