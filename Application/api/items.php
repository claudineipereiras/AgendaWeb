<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: public, max-age=120');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$tab = filter_input(INPUT_GET, 'tab', FILTER_DEFAULT) ?? 'news';
$allowedTabs = ['news', 'politics', 'culture'];

if (!in_array($tab, $allowedTabs, true)) {
    $tab = 'news';
}

$limit = min(max((int)(filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT) ?: 30), 1), 50);
$offset = max((int)(filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT) ?: 0), 0);

try {
    $pdo = Database::getConnection();

    $sql = "SELECT i.id, s.name as source_name, i.category_tab, i.title, i.link, i.summary, i.published_at
            FROM items i
            JOIN sources s ON s.id = i.source_id
            WHERE i.category_tab = :tab
            ORDER BY i.published_at DESC
            LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['tab' => $tab]);
    $items = $stmt->fetchAll();

    echo json_encode([
        'status' => 'success',
        'tab'    => $tab,
        'count'  => count($items),
        'offset' => $offset,
        'limit'  => $limit,
        'data'   => $items
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to fetch items']);
}
