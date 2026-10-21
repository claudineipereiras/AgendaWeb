<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Auth.php';

use AgendaWeb\Database;
use AgendaWeb\Auth;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = filter_input(INPUT_GET, 'action', FILTER_DEFAULT) ?? 'list';

try {
    $pdo = Database::getConnection();

    // All user management routes require admin role
    $currentUser = Auth::requireAuth($pdo, 'admin');

    // 1. List all users
    if ($action === 'list') {
        $stmt = $pdo->query("
            SELECT id, name, email, role, is_active, last_login_at, created_at, updated_at
            FROM users
            ORDER BY (role = 'admin') DESC, name ASC
        ");
        $users = $stmt->fetchAll();

        echo json_encode([
            'status' => 'success',
            'count'  => count($users),
            'data'   => $users
        ]);
        exit;
    }

    // 2. Create new user / team member
    if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $name = trim((string)($input['name'] ?? ''));
        $email = trim(strtolower((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $role = trim((string)($input['role'] ?? 'manager'));

        if (empty($name) || empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Name, email, and password are required.']);
            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid email address format.']);
            exit;
        }

        if (strlen($password) < 8) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Password must be at least 8 characters long.']);
            exit;
        }

        if (!in_array($role, ['admin', 'manager'], true)) {
            $role = 'manager';
        }

        // Check if email already exists
        $chk = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $chk->execute([$email]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['status' => 'error', 'message' => 'A user with this email address already exists.']);
            exit;
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $ins = $pdo->prepare("
            INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, NOW(), NOW())
        ");
        $ins->execute([$name, $email, $passwordHash, $role]);
        $newId = (int)$pdo->lastInsertId();

        echo json_encode([
            'status'  => 'success',
            'message' => "Team member '$name' created successfully.",
            'id'      => $newId
        ]);
        exit;
    }

    // 3. Toggle user active/inactive status
    if ($action === 'toggle_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'User ID is required.']);
            exit;
        }

        // Prevent self-deactivation
        if ($id === (int)$currentUser['id']) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'You cannot deactivate your own account.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, name, is_active FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $target = $stmt->fetch();

        if (!$target) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'User not found.']);
            exit;
        }

        $newStatus = ((int)$target['is_active'] === 1) ? 0 : 1;
        $pdo->prepare("UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $id]);

        // If deactivated, kill any active sessions
        if ($newStatus === 0) {
            $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$id]);
        }

        echo json_encode([
            'status'    => 'success',
            'message'   => "User '{$target['name']}' is now " . ($newStatus === 1 ? 'Active' : 'Inactive'),
            'is_active' => $newStatus
        ]);
        exit;
    }

    // 4. Change role (manager <-> admin)
    if ($action === 'change_role' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($input['id'] ?? 0);
        $role = trim((string)($input['role'] ?? ''));

        if (!$id || !in_array($role, ['admin', 'manager'], true)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'User ID and valid role (admin or manager) are required.']);
            exit;
        }

        // If demoting self from admin, ensure another active admin exists
        if ($id === (int)$currentUser['id'] && $role !== 'admin') {
            $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1")->fetchColumn();
            if ($adminCount <= 1) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Cannot demote yourself: at least one active Admin must remain in the system.']);
                exit;
            }
        }

        $stmt = $pdo->prepare("UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$role, $id]);

        echo json_encode([
            'status'  => 'success',
            'message' => "Role updated to '$role'."
        ]);
        exit;
    }

    // 5. Admin reset password for a team member
    if ($action === 'reset_password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($input['id'] ?? 0);
        $newPassword = (string)($input['new_password'] ?? '');

        if (!$id || strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'User ID and new password (min 8 characters) are required.']);
            exit;
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?")->execute([$hash, $id]);

        // Invalidate user's existing sessions
        $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$id]);

        echo json_encode([
            'status'  => 'success',
            'message' => 'Password reset successfully for user.'
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => "Unknown user action: $action"]);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'User management error: ' . $e->getMessage()]);
}
