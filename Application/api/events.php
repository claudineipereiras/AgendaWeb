<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: public, max-age=60');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$config = require __DIR__ . '/../config/config.php';
$appUrl = rtrim($config['app']['url'], '/');

$venue = filter_input(INPUT_GET, 'venue', FILTER_DEFAULT) ?? 'all';
$category = filter_input(INPUT_GET, 'category', FILTER_DEFAULT) ?? 'all';
$limit = min(max((int)(filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT) ?: 50), 1), 100);
$offset = max((int)(filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT) ?: 0), 0);

try {
    $pdo = Database::getConnection();

    $where = ["start_time >= NOW()"];
    $params = [];

    if ($venue !== 'all') {
        $where[] = "venue_slug = :venue";
        $params['venue'] = $venue;
    }
    if ($category !== 'all' && $category !== 'All') {
        $where[] = "category = :category";
        $params['category'] = $category;
    }

    $whereSql = implode(' AND ', $where);

    // Get total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM events WHERE {$whereSql}");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Dynamically retrieve distinct available categories for auto-grouping
    $catQuery = "SELECT DISTINCT category FROM events WHERE start_time >= NOW()";
    $catParams = [];
    if ($venue !== 'all') {
        $catQuery .= " AND venue_slug = :vslug";
        $catParams['vslug'] = $venue;
    }
    $catQuery .= " ORDER BY category ASC";
    $catStmt = $pdo->prepare($catQuery);
    $catStmt->execute($catParams);
    $rawCategories = $catStmt->fetchAll(PDO::FETCH_COLUMN);
    $categories = array_values(array_unique(array_merge(['All'], array_filter($rawCategories))));

    // Query events with image_url
    $sql = "SELECT id, venue_slug, venue_name, title, description, category, 
                   start_time, end_time, address, ticket_url, image_url, origin, is_verified
            FROM events
            WHERE {$whereSql}
            ORDER BY start_time ASC
            LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $events = $stmt->fetchAll();

    // Append helper URLs
    foreach ($events as &$ev) {
        $ev['calendar_url'] = "{$appUrl}/calendar.php?id={$ev['id']}";
    }

    // Query active venues for grouping and metadata
    $venues = [];
    try {
        $venuesStmt = $pdo->query("
            SELECT v.slug, v.name, v.address, v.website_url, v.feed_url,
                   COUNT(e.id) AS event_count
            FROM venues v
            LEFT JOIN events e ON e.venue_slug = v.slug AND e.start_time >= NOW()
            WHERE v.is_active = 1
            GROUP BY v.id
            ORDER BY v.name ASC
        ");
        if ($venuesStmt) {
            $venues = $venuesStmt->fetchAll();
        }
    } catch (\Throwable $ve) {
        // Fallback gracefully if venues table is not yet migrated
        $venues = [];
    }

    echo json_encode([
        'status'     => 'success',
        'count'      => count($events),
        'total'      => $total,
        'offset'     => $offset,
        'limit'      => $limit,
        'categories' => $categories,
        'venues'     => $venues,
        'data'       => $events
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to fetch events']);
}
