<?php
declare(strict_types=1);

namespace AgendaWeb;

use PDO;

/**
 * Authentication and Role-Based Access Control Helper
 */
class Auth
{
    /**
     * Extracts token from Authorization header, X-Admin-Token header, or query param
     */
    public static function getBearerToken(): ?string
    {
        $headers = [];
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        } else {
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) === 'HTTP_') {
                    $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
                }
            }
        }

        // Check Authorization header
        $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
        if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        // Check custom X-Admin-Token
        if (!empty($headers['X-Admin-Token'] ?? $headers['x-admin-token'] ?? '')) {
            return $headers['X-Admin-Token'] ?? $headers['x-admin-token'];
        }

        return $_GET['token'] ?? null;
    }

    /**
     * Authenticates request via Session Token or Master Key fallback
     * Returns user array or null
     */
    public static function getUser(PDO $pdo): ?array
    {
        $token = self::getBearerToken();
        if ($token) {
            $stmt = $pdo->prepare("
                SELECT u.id, u.name, u.email, u.role, u.is_active, u.password_hash, s.token, s.expires_at
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1
                LIMIT 1
            ");
            $stmt->execute([$token]);
            $user = $stmt->fetch();
            if ($user) {
                return $user;
            }
        }

        // Fallback: Check X-Admin-Key for legacy master bypass
        $config = require __DIR__ . '/../config/config.php';
        $expectedKey = $config['app']['admin_key'] ?? 'agendaweb-admin-secret-2026';
        $providedKey = $_SERVER['HTTP_X_ADMIN_KEY'] ?? ($_GET['key'] ?? '');
        if (!empty($providedKey) && hash_equals($expectedKey, $providedKey)) {
            return [
                'id' => 0,
                'name' => 'System Superadmin',
                'email' => 'admin@agendaweb.app',
                'role' => 'admin',
                'is_active' => 1
            ];
        }

        return null;
    }

    /**
     * Enforces required role. Exits with 401 or 403 if unauthorized.
     */
    public static function requireAuth(PDO $pdo, string $minimumRole = 'manager'): array
    {
        $user = self::getUser($pdo);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Please log in with your email and password']);
            exit;
        }

        if ($minimumRole === 'admin' && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'Forbidden: Admin privilege required for this action']);
            exit;
        }

        return $user;
    }
}
