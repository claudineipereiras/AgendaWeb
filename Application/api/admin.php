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

    // 2. Curated Sources List
    if ($action === 'sources') {
        $stmt = $pdo->query("SELECT id, slug, name, type, url, category_tab, is_active, last_polled_at FROM sources ORDER BY category_tab ASC, name ASC");
        $sources = $stmt->fetchAll();

        echo json_encode([
            'status' => 'success',
            'count'  => count($sources),
            'data'   => $sources
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

        echo json_encode([
            'status'  => 'success',
            'message' => "Source '$name' added successfully",
            'id'      => (int)$pdo->lastInsertId()
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

    // 9. Trigger Ingestion Sync Now
    if ($action === 'sync_now' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        ob_start();
        include __DIR__ . '/../sync_sources.php';
        $logOutput = ob_get_clean();

        echo json_encode([
            'status'  => 'success',
            'message' => 'Sync worker executed',
            'log'     => $logOutput
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
