<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!is_array($payload)) {
    $payload = $_POST;
}

$name     = trim((string)($payload['name'] ?? ''));
$email    = trim((string)($payload['email'] ?? ''));
$category = trim((string)($payload['category'] ?? 'general'));
$message  = trim((string)($payload['message'] ?? ''));

if (empty($message)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Suggestion message is required.']);
    exit;
}

if (!in_array($category, ['feature', 'venue_feed', 'bug', 'general'], true)) {
    $category = 'general';
}

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare("
        INSERT INTO suggestions (name, email, category, message, status, created_at)
        VALUES (:name, :email, :category, :message, 'new', NOW())
    ");

    $stmt->execute([
        'name'     => !empty($name) ? mb_substr($name, 0, 150) : null,
        'email'    => !empty($email) ? mb_substr($email, 0, 150) : null,
        'category' => $category,
        'message'  => mb_substr($message, 0, 5000),
    ]);

    echo json_encode([
        'status'  => 'success',
        'message' => 'Thank you! Your suggestion has been saved to the curator inbox.'
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Unable to save suggestion. Please try again later.'
    ]);
}
