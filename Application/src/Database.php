<?php
declare(strict_types=1);

namespace AgendaWeb;

use PDO;
use PDOException;

/**
 * Database Singleton Connection Manager
 */
class Database
{
    private static ?PDO $instance = null;

    private function __construct() {}
    private function __clone() {}

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $config = require __DIR__ . '/../config/config.php';
            $db = $config['db'];

            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                $db['host'],
                $db['name'],
                $db['charset']
            );

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, $db['user'], $db['pass'], $options);
            } catch (PDOException $e) {
                // Return clean error response if called in web context
                if (php_sapi_name() !== 'cli') {
                    http_response_code(500);
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode(['error' => 'Database connection failed']);
                    exit;
                }
                throw $e;
            }
        }

        return self::$instance;
    }
}
