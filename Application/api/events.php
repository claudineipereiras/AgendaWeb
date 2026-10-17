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

    // Query events
    $sql = "SELECT id, venue_slug, venue_name, title, description, category, 
                   start_time, end_time, address, ticket_url, origin, is_verified
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

    echo json_encode([
        'status' => 'success',
        'count'  => count($events),
        'total'  => $total,
        'offset' => $offset,
        'limit'  => $limit,
        'data'   => $events
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to fetch events']);
}
