<?php
declare(strict_types=1);

/**
 * AgendaWeb Shared Configuration Loader
 */

$defaults = [
    'db' => [
        'host'    => getenv('DB_HOST') ?: 'localhost',
        'name'    => getenv('DB_NAME') ?: 'u123456789_agenda',
        'user'    => getenv('DB_USER') ?: 'u123456789_admin',
        'pass'    => getenv('DB_PASS') ?: 'YourSecretPasswordHere',
        'charset' => getenv('DB_CHARSET') ?: 'utf8mb4',
    ],
    'app' => [
        'env'      => getenv('APP_ENV') ?: 'production',
        'url'      => getenv('APP_URL') ?: 'https://agendaweb.app',
        'timezone' => getenv('APP_TIMEZONE') ?: 'Australia/Melbourne',
        'admin_key' => getenv('ADMIN_API_KEY') ?: 'agendaweb-admin-secret-2026',
        'bot_user_agent' => 'AgendaWeb-Bot/1.0 (+https://agendaweb.app; cultural calendar indexer)',
    ]
];

// Allow local overrides if config.local.php exists (ignored by Git)
$localConfig = __DIR__ . '/config.local.php';
if (file_exists($localConfig)) {
    $custom = require $localConfig;
    if (is_array($custom)) {
        $defaults = array_replace_recursive($defaults, $custom);
    }
}

date_default_timezone_set($defaults['app']['timezone']);

return $defaults;
