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
$allowedTabs = ['news', 'politics', 'culture', 'blogs'];

if (!in_array($tab, $allowedTabs, true)) {
    $tab = 'news';
}

$category = filter_input(INPUT_GET, 'category', FILTER_DEFAULT) ?? 'all';
$limit = min(max((int)(filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT) ?: 30), 1), 50);
$offset = max((int)(filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT) ?: 0), 0);

try {
    $pdo = Database::getConnection();

    $where = ["i.category_tab = :tab"];
    $params = ['tab' => $tab];

    if ($category !== 'all' && $category !== 'All') {
        $where[] = "(s.name = :category OR i.category = :category)";
        $params['category'] = $category;
    }

    $whereSql = implode(' AND ', $where);

    // Dynamic distinct active sources/feeds for this tab
    $srcStmt = $pdo->prepare("SELECT DISTINCT s.name FROM items i JOIN sources s ON s.id = i.source_id WHERE i.category_tab = :tab AND s.name IS NOT NULL AND s.name != '' ORDER BY s.name ASC");
    $srcStmt->execute(['tab' => $tab]);
    $rawSources = $srcStmt->fetchAll(PDO::FETCH_COLUMN);
    $sources = array_values(array_unique(array_merge(['All'], array_filter($rawSources))));

    $sql = "SELECT i.id, s.name as source_name, i.category_tab, i.category, i.title, i.link, i.summary, i.content, i.image_url, i.published_at
            FROM items i
            JOIN sources s ON s.id = i.source_id
            WHERE {$whereSql}
            ORDER BY i.published_at DESC
            LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    echo json_encode([
        'status'     => 'success',
        'tab'        => $tab,
        'count'      => count($items),
        'offset'     => $offset,
        'limit'      => $limit,
        'categories' => $sources,
        'sources'    => $sources,
        'data'       => $items
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to fetch items']);
}
