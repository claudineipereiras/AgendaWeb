<?php
declare(strict_types=1);

/**
 * =============================================================================
 * AgendaWeb Hostinger Deployment & Health Diagnostic Tool
 * =============================================================================
 * 
 * Run via CLI:
 *   php setup.php
 *   php setup.php --migrate
 * 
 * Or via Web Browser:
 *   https://yourdomain.com/setup.php
 */

$isCli = (php_sapi_name() === 'cli');
$lockFile = __DIR__ . '/config/.installed';
$schemaFile = __DIR__ . '/config/schema.sql';
$configFile = __DIR__ . '/config/config.local.php';

// If locked and not explicitly unlocking, prevent unauthorized re-installation
$isLocked = file_exists($lockFile);

$action = $_POST['action'] ?? ($isCli ? ($argv[1] ?? '') : '');

$diagnostics = [
    'php_version' => [
        'title'   => 'PHP Version (>= 8.1 required, 8.2/8.3 recommended)',
        'passed'  => version_compare(PHP_VERSION, '8.1.0', '>='),
        'current' => PHP_VERSION,
        'help'    => 'Update PHP version in Hostinger hPanel ➔ Advanced ➔ PHP Configuration.'
    ],
    'extensions' => []
];

$requiredExtensions = [
    'pdo'       => 'Core PDO support',
    'pdo_mysql' => 'MySQL database connectivity for Hostinger',
    'curl'      => 'High-performance HTTP feed fetching',
    'dom'       => 'DOM parsing for Schema.org JSON-LD and HTML extraction',
    'libxml'    => 'XML core processing',
    'simplexml' => 'RSS 2.0 and Atom XML syndication parser',
    'mbstring'  => 'Multibyte string support for Unicode broadsheet typography'
];

foreach ($requiredExtensions as $ext => $desc) {
    $diagnostics['extensions'][$ext] = [
        'title'  => "Extension: {$ext} ({$desc})",
        'passed' => extension_loaded($ext),
        'help'   => "Enable {$ext} in Hostinger hPanel ➔ Advanced ➔ PHP Configuration ➔ PHP Extensions."
    ];
}

// Check configuration file
$diagnostics['config_local'] = [
    'title'  => 'Configuration File (config/config.local.php)',
    'passed' => file_exists($configFile),
    'help'   => 'Copy Application/config/config.local.php.example to Application/config/config.local.php and fill in your Hostinger MySQL details.'
];

// Check database connection
$dbConnected = false;
$dbError = null;
$pdo = null;

if (file_exists($configFile)) {
    try {
        require_once __DIR__ . '/src/Database.php';
        $pdo = \AgendaWeb\Database::getConnection();
        $dbConnected = true;
    } catch (\Throwable $e) {
        $dbError = $e->getMessage();
    }
}

$diagnostics['db_connection'] = [
    'title'   => 'MySQL Database Connection',
    'passed'  => $dbConnected,
    'current' => $dbConnected ? 'Connected successfully' : ($dbError ?: 'Configuration missing'),
    'help'    => 'Verify database name, user, password, and host in config/config.local.php.'
];

// Check existing tables
$tables = ['cities', 'sources', 'venues', 'events', 'items', 'suggestions', 'users', 'user_sessions'];
$existingTables = [];
$missingTables = $tables;

if ($dbConnected && $pdo) {
    try {
        $stmt = $pdo->query("SHOW TABLES");
        $all = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $existingTables = array_intersect($tables, $all);
        $missingTables = array_diff($tables, $all);
    } catch (\Throwable $e) {
        // Ignored
    }
}

$diagnostics['db_tables'] = [
    'title'   => 'Database Tables (' . count($existingTables) . '/' . count($tables) . ' present)',
    'passed'  => count($missingTables) === 0,
    'current' => count($missingTables) === 0 ? 'All 8 core tables present' : 'Missing: ' . implode(', ', $missingTables),
    'help'    => 'Run the automatic table migration below or import config/schema.sql in Hostinger phpMyAdmin.'
];

// Handle Actions (Migrate / Lock / Unlock)
$message = null;
$messageType = 'info';

if (($action === '--migrate' || $action === 'migrate') && $dbConnected && $pdo) {
    if ($isLocked && !$isCli) {
        $message = 'Setup is currently locked for security. Remove config/.installed to re-run migrations.';
        $messageType = 'error';
    } else {
        if (!file_exists($schemaFile)) {
            $message = "Schema file not found at: {$schemaFile}";
            $messageType = 'error';
        } else {
            try {
                $sql = file_get_contents($schemaFile);
                $pdo->exec($sql);
                $message = 'Database schema successfully imported! All tables and reference cities have been provisioned.';
                $messageType = 'success';
                // Refresh table lists
                $stmt = $pdo->query("SHOW TABLES");
                $all = $stmt->fetchAll(PDO::FETCH_COLUMN);
                $existingTables = array_intersect($tables, $all);
                $missingTables = array_diff($tables, $all);
                $diagnostics['db_tables']['passed'] = (count($missingTables) === 0);
                $diagnostics['db_tables']['current'] = count($missingTables) === 0 ? 'All 8 core tables present' : 'Missing: ' . implode(', ', $missingTables);
            } catch (\Throwable $e) {
                $message = 'Migration error: ' . $e->getMessage();
                $messageType = 'error';
            }
        }
    }
} elseif ($action === 'lock') {
    file_put_contents($lockFile, date('c'));
    $isLocked = true;
    $message = 'Setup locked successfully! You can delete or keep setup.php safely.';
    $messageType = 'success';
}

// Detect server paths for Hostinger cron
$currentPath = realpath(__DIR__);
$cronCommand = "php {$currentPath}/sync_sources.php > /dev/null 2>&1";

// Output CLI representation
if ($isCli) {
    echo "========================================================\n";
    echo " AgendaWeb Hostinger Deployment & Health Diagnostic\n";
    echo "========================================================\n\n";

    echo ($diagnostics['php_version']['passed'] ? "  [✓] " : "  [✗] ") . $diagnostics['php_version']['title'] . " ({$diagnostics['php_version']['current']})\n";

    foreach ($diagnostics['extensions'] as $ext => $info) {
        echo ($info['passed'] ? "  [✓] " : "  [✗] ") . $info['title'] . "\n";
    }

    echo ($diagnostics['config_local']['passed'] ? "  [✓] " : "  [✗] ") . $diagnostics['config_local']['title'] . "\n";
    echo ($diagnostics['db_connection']['passed'] ? "  [✓] " : "  [✗] ") . $diagnostics['db_connection']['title'] . " ({$diagnostics['db_connection']['current']})\n";
    echo ($diagnostics['db_tables']['passed'] ? "  [✓] " : "  [✗] ") . $diagnostics['db_tables']['title'] . " ({$diagnostics['db_tables']['current']})\n\n";

    if (!empty($message)) {
        echo ">>> {$message}\n\n";
    }

    if (count($missingTables) > 0) {
        echo "Run with --migrate to auto-import the database schema:\n";
        echo "  php setup.php --migrate\n\n";
    }

    echo "Hostinger Scheduled Cron Command (Every 30 mins):\n";
    echo "  {$cronCommand}\n\n";
    exit(0);
}

// Web GUI Presentation
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgendaWeb — Hostinger Deployment Diagnostic</title>
  <style>
    :root {
      --racing-green: #1B3B2B;
      --amber-rust: #D96B27;
      --oat: #EAE6DF;
      --chalk: #F7F5F0;
      --nightfall: #141716;
      --white: #FFFFFF;
      --success: #22c55e;
      --error: #ef4444;
      --font-serif: "Newsreader", Georgia, serif;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body {
      background: var(--chalk);
      color: var(--nightfall);
      font-family: var(--font-sans);
      margin: 0;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: var(--white);
      border: 1px solid var(--oat);
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    h1 {
      font-family: var(--font-serif);
      font-size: 2rem;
      margin-top: 0;
      color: var(--racing-green);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-error { background: #fee2e2; color: #b91c1c; }
    .badge-warn { background: #fef3c7; color: #b45309; }
    .card {
      border: 1px solid var(--oat);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
      background: #faf9f6;
    }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--oat);
    }
    .check-item:last-child { border-bottom: none; }
    .icon {
      font-size: 1.1rem;
      font-weight: bold;
      line-height: 1.2;
    }
    .icon-pass { color: var(--success); }
    .icon-fail { color: var(--error); }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--racing-green);
      color: var(--white);
      padding: 10px 18px;
      border-radius: 6px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      font-size: 0.92rem;
    }
    .btn:hover { background: #234c38; }
    .btn-secondary {
      background: var(--oat);
      color: var(--nightfall);
    }
    .btn-secondary:hover { background: #dcd7ce; }
    .alert {
      padding: 14px 18px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 0.92rem;
    }
    .alert-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #202422;
      color: #86efac;
      padding: 10px 14px;
      border-radius: 6px;
      display: block;
      overflow-x: auto;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <span>✦ AgendaWeb</span>
      <span class="badge badge-success">Hostinger Diagnostic</span>
    </h1>
    <p style="color:#555; margin-top:-4px;">
      Hostinger shared & cloud environment readiness checker and one-click database provisioner.
    </p>

    <?php if ($message): ?>
      <div class="alert alert-<?= htmlspecialchars($messageType) ?>">
        <?= htmlspecialchars($message) ?>
      </div>
    <?php endif; ?>

    <!-- Server & PHP Extensions -->
    <div class="card">
      <h3 style="margin-top:0; font-size:1.05rem;">1. PHP Environment & Required Extensions</h3>
      
      <div class="check-item">
        <span class="icon <?= $diagnostics['php_version']['passed'] ? 'icon-pass' : 'icon-fail' ?>">
          <?= $diagnostics['php_version']['passed'] ? '✓' : '✗' ?>
        </span>
        <div style="flex:1;">
          <strong>PHP Version:</strong> <?= htmlspecialchars(PHP_VERSION) ?>
          <?php if (!$diagnostics['php_version']['passed']): ?>
            <div style="color:var(--error); font-size:0.85rem;"><?= htmlspecialchars($diagnostics['php_version']['help']) ?></div>
          <?php endif; ?>
        </div>
      </div>

      <?php foreach ($diagnostics['extensions'] as $ext => $item): ?>
        <div class="check-item">
          <span class="icon <?= $item['passed'] ? 'icon-pass' : 'icon-fail' ?>">
            <?= $item['passed'] ? '✓' : '✗' ?>
          </span>
          <div style="flex:1;">
            <strong><?= htmlspecialchars($item['title']) ?></strong>
            <?php if (!$item['passed']): ?>
              <div style="color:var(--error); font-size:0.85rem;"><?= htmlspecialchars($item['help']) ?></div>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <!-- Configuration & Database Connectivity -->
    <div class="card">
      <h3 style="margin-top:0; font-size:1.05rem;">2. Configuration & MySQL Database</h3>

      <div class="check-item">
        <span class="icon <?= $diagnostics['config_local']['passed'] ? 'icon-pass' : 'icon-fail' ?>">
          <?= $diagnostics['config_local']['passed'] ? '✓' : '✗' ?>
        </span>
        <div style="flex:1;">
          <strong>Configuration File:</strong> <?= $diagnostics['config_local']['passed'] ? '<code>config/config.local.php</code> is present' : 'Missing <code>config/config.local.php</code>' ?>
          <?php if (!$diagnostics['config_local']['passed']): ?>
            <div style="color:var(--error); font-size:0.85rem; margin-top:4px;">
              Copy <code>Application/config/config.local.php.example</code> to <code>Application/config/config.local.php</code> and enter your Hostinger database credentials.
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="check-item">
        <span class="icon <?= $diagnostics['db_connection']['passed'] ? 'icon-pass' : 'icon-fail' ?>">
          <?= $diagnostics['db_connection']['passed'] ? '✓' : '✗' ?>
        </span>
        <div style="flex:1;">
          <strong>Database Connection:</strong> <?= htmlspecialchars($diagnostics['db_connection']['current']) ?>
          <?php if (!$diagnostics['db_connection']['passed']): ?>
            <div style="color:var(--error); font-size:0.85rem; margin-top:4px;">
              <?= htmlspecialchars($diagnostics['db_connection']['help']) ?>
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="check-item">
        <span class="icon <?= $diagnostics['db_tables']['passed'] ? 'icon-pass' : 'icon-fail' ?>">
          <?= $diagnostics['db_tables']['passed'] ? '✓' : '✗' ?>
        </span>
        <div style="flex:1;">
          <strong>Schema Tables:</strong> <?= htmlspecialchars($diagnostics['db_tables']['current']) ?>
          <?php if (count($missingTables) > 0 && $dbConnected): ?>
            <form method="POST" style="margin-top:10px;">
              <input type="hidden" name="action" value="migrate">
              <button type="submit" class="btn">
                ⚡ Initialize Database & Create Tables
              </button>
            </form>
          <?php endif; ?>
        </div>
      </div>
    </div>

    <!-- Hostinger Cron Job Configuration -->
    <div class="card">
      <h3 style="margin-top:0; font-size:1.05rem;">3. Hostinger Scheduled Task (Cron Job)</h3>
      <p style="font-size:0.9rem; color:#444; margin-top:0;">
        In Hostinger hPanel ➔ <strong>Advanced ➔ Cron Jobs</strong>, create a custom cron job to trigger background ingestion every 30 minutes:
      </p>
      <code><?= htmlspecialchars($cronCommand) ?></code>
    </div>

    <!-- Actions & Links -->
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:24px;">
      <a href="index.html" class="btn">Open AgendaWeb Reader ↗</a>
      <a href="admin/index.html" class="btn btn-secondary">Open Admin Portal ↗</a>
      
      <?php if (!$isLocked): ?>
        <form method="POST" style="margin:0; display:inline;">
          <input type="hidden" name="action" value="lock">
          <button type="submit" class="btn btn-secondary" onclick="return confirm('Lock setup to prevent further automatic schema changes?')">
            🔒 Lock Setup
          </button>
        </form>
      <?php else: ?>
        <span class="badge badge-success" style="padding:8px 12px;">🔒 Setup Locked</span>
      <?php endif; ?>
    </div>
  </div>
</body>
</html>
