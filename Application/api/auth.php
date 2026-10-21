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

$action = filter_input(INPUT_GET, 'action', FILTER_DEFAULT) ?? 'me';

try {
    $pdo = Database::getConnection();

    // 1. Login with Email and Password
    if ($action === 'login') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim((string)($input['email'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Email and password are required.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Invalid email or password.']);
            exit;
        }

        if ((int)$user['is_active'] !== 1) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'Account is inactive. Please contact an administrator.']);
            exit;
        }

        // Generate 64-char secure random token
        $token = bin2hex(random_bytes(32));
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

        $ins = $pdo->prepare("INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)");
        $ins->execute([$user['id'], $token, $ip, $ua, $expiresAt]);

        // Update last login
        $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?")->execute([$user['id']]);

        echo json_encode([
            'status' => 'success',
            'token'  => $token,
            'user'   => [
                'id'    => (int)$user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role']
            ]
        ]);
        exit;
    }

    // 2. Check current session
    if ($action === 'me') {
        $user = Auth::requireAuth($pdo, 'manager');
        echo json_encode([
            'status' => 'success',
            'user'   => [
                'id'    => (int)$user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role']
            ]
        ]);
        exit;
    }

    // 3. Update Password inside admin portal
    if ($action === 'change_password') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
            exit;
        }

        $user = Auth::requireAuth($pdo, 'manager');
        $input = json_decode(file_get_contents('php://input'), true);
        $currentPassword = (string)($input['current_password'] ?? '');
        $newPassword = (string)($input['new_password'] ?? '');

        if (empty($currentPassword) || empty($newPassword)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Current password and new password are required.']);
            exit;
        }

        if (strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'New password must be at least 8 characters long.']);
            exit;
        }

        // Verify current password against stored hash
        if (!password_verify($currentPassword, $user['password_hash'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Incorrect current password.']);
            exit;
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $upd = $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
        $upd->execute([$newHash, $user['id']]);

        echo json_encode([
            'status'  => 'success',
            'message' => 'Password updated successfully.'
        ]);
        exit;
    }

    // 4. Logout (invalidate session)
    if ($action === 'logout') {
        $token = Auth::getBearerToken();
        if ($token) {
            $del = $pdo->prepare("DELETE FROM user_sessions WHERE token = ?");
            $del->execute([$token]);
        }
        echo json_encode(['status' => 'success', 'message' => 'Logged out successfully.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown auth action.']);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Authentication server error: ' . $e->getMessage()]);
}
