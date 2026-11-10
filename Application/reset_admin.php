<?php
declare(strict_types=1);

/**
 * =============================================================================
 * AgendaWeb - Production Admin Account Recovery & Password Reset Tool
 * =============================================================================
 * 
 * Access via Web Browser:
 *   https://yourdomain.com/reset_admin.php
 * 
 * Security Warning:
 *   Delete this file from your server after recovering your admin credentials!
 */

header('Content-Type: text/html; charset=utf-8');

$configFile = __DIR__ . '/config/config.local.php';
$dbConnected = false;
$dbError = null;
$pdo = null;
$message = null;
$messageType = null;

if (file_exists($configFile)) {
    try {
        require_once __DIR__ . '/src/Database.php';
        $pdo = \AgendaWeb\Database::getConnection();
        $dbConnected = true;
    } catch (\Throwable $e) {
        $dbError = $e->getMessage();
    }
} else {
    $dbError = "Configuration file 'config/config.local.php' not found. Please ensure database credentials are configured.";
}

// Handle Password Reset / Account Creation
if ($dbConnected && $pdo && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim((string)($_POST['email'] ?? ''));
    $name = trim((string)($_POST['name'] ?? 'Administrator'));
    $password = trim((string)($_POST['password'] ?? ''));
    $role = in_array($_POST['role'] ?? '', ['admin', 'manager'], true) ? $_POST['role'] : 'admin';

    if (empty($email) || empty($password)) {
        $message = "Email and new password are required.";
        $messageType = "error";
    } elseif (strlen($password) < 6) {
        $message = "Password should be at least 6 characters long.";
        $messageType = "error";
    } else {
        try {
            $hash = password_hash($password, PASSWORD_BCRYPT);

            $stmt = $pdo->prepare("
                INSERT INTO users (name, email, password_hash, role, is_active)
                VALUES (:name, :email, :hash, :role, 1)
                ON DUPLICATE KEY UPDATE 
                    password_hash = VALUES(password_hash),
                    name = IF(VALUES(name) != '', VALUES(name), name),
                    role = VALUES(role),
                    is_active = 1
            ");
            $stmt->execute([
                'name'  => $name ?: 'Administrator',
                'email' => $email,
                'hash'  => $hash,
                'role'  => $role
            ]);

            // Clear any stale sessions for this user so next login is clean
            try {
                $uidStmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
                $uidStmt->execute([$email]);
                $userId = $uidStmt->fetchColumn();
                if ($userId) {
                    $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$userId]);
                }
            } catch (\Throwable $se) {}

            $message = "✓ Password successfully reset for '<strong>" . htmlspecialchars($email, ENT_QUOTES) . "</strong>'! You can now log into the <a href='admin/index.html' style='color:#15803d; font-weight:700; text-decoration:underline;'>Admin Portal</a> with your new password.";
            $messageType = "success";

        } catch (\Throwable $e) {
            $message = "Database error updating password: " . $e->getMessage();
            $messageType = "error";
        }
    }
}

// Fetch current users in database
$existingUsers = [];
if ($dbConnected && $pdo) {
    try {
        $uStmt = $pdo->query("SELECT id, name, email, role, is_active, created_at, last_login_at FROM users ORDER BY id ASC");
        if ($uStmt) {
            $existingUsers = $uStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    } catch (\Throwable $e) {
        // Table might not exist yet
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Account Recovery - AgendaWeb</title>
  <style>
    :root {
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --primary: #15803d;
      --primary-hover: #166534;
      --danger: #dc2626;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background-color: var(--bg-color);
      color: var(--text-main);
      line-height: 1.5;
      padding: 32px 16px;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 1.5rem;
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .header p {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .alert {
      padding: 12px 16px;
      border-radius: var(--radius);
      margin-bottom: 18px;
      font-size: 0.9rem;
    }
    .alert-success {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }
    .alert-error {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }
    .alert-warning {
      background-color: #fffbeb;
      border: 1px solid #fef3c7;
      color: #92400e;
    }
    .form-group {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-main);
    }
    input[type="text"], input[type="email"], input[type="password"], select {
      width: 100%;
      padding: 9px 12px;
      font-size: 0.9rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      outline: none;
      background: #fff;
    }
    input:focus, select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.2);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 18px;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: var(--radius);
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }
    .btn-primary {
      background-color: var(--primary);
      color: #fff;
      width: 100%;
    }
    .btn-primary:hover {
      background-color: var(--primary-hover);
    }
    .table-container {
      overflow-x: auto;
      margin-top: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.83rem;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: var(--text-muted);
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-admin { background: #dcfce7; color: #15803d; }
    .badge-manager { background: #e0f2fe; color: #0369a1; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
    .fill-btn {
      background: none;
      border: 1px solid var(--border-color);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      color: var(--primary);
      font-weight: 600;
    }
    .fill-btn:hover {
      background: #f1f5f9;
    }
    .notice {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 8px;
    }
  </style>
</head>
<body>

<div class="container">
  <div class="header">
    <h1>🔑 AgendaWeb Admin Recovery</h1>
    <p>Reset your admin password or create a new administrator account directly on production.</p>
  </div>

  <?php if (!empty($message)): ?>
    <div class="alert alert-<?= htmlspecialchars($messageType, ENT_QUOTES) ?>">
      <?= $message ?>
    </div>
  <?php endif; ?>

  <?php if (!$dbConnected): ?>
    <div class="alert alert-error">
      <strong>Database Connection Error:</strong><br>
      <?= htmlspecialchars($dbError ?: 'Could not connect to database.', ENT_QUOTES) ?>
      <p style="margin-top:8px;">Please verify your database credentials inside <code>Application/config/config.local.php</code>.</p>
    </div>
  <?php else: ?>

    <!-- Current Registered Users in MySQL -->
    <div class="card">
      <div class="card-title">👥 Existing User Accounts in Database</div>
      <?php if (empty($existingUsers)): ?>
        <p style="color:var(--text-muted); font-size:0.88rem;">No users found in database. Use the form below to create your initial administrator account.</p>
      <?php else: ?>
        <p style="color:var(--text-muted); font-size:0.82rem; margin-bottom:8px;">
          Click "Use Email" next to any account to populate the form below:
        </p>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($existingUsers as $u): ?>
                <tr>
                  <td><?= htmlspecialchars((string)$u['id']) ?></td>
                  <td><strong><?= htmlspecialchars($u['name'] ?: 'Unnamed') ?></strong></td>
                  <td><code><?= htmlspecialchars($u['email']) ?></code></td>
                  <td><span class="badge badge-<?= htmlspecialchars($u['role']) ?>"><?= htmlspecialchars($u['role']) ?></span></td>
                  <td>
                    <?php if ((int)$u['is_active'] === 1): ?>
                      <span class="badge badge-active">Active</span>
                    <?php else: ?>
                      <span class="badge badge-inactive">Inactive</span>
                    <?php endif; ?>
                  </td>
                  <td>
                    <button type="button" class="fill-btn" onclick="populateEmail('<?= htmlspecialchars($u['email'], ENT_QUOTES) ?>', '<?= htmlspecialchars($u['name'] ?? '', ENT_QUOTES) ?>')">
                      Use Email
                    </button>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>

    <!-- Password Reset / Create Admin Form -->
    <div class="card">
      <div class="card-title">🛠️ Set New Password / Provision Admin</div>
      <form method="POST" action="">
        <div class="form-group">
          <label for="email">Account Email</label>
          <input type="email" id="email" name="email" placeholder="e.g. admin@agendaweb.app or your personal email" required value="<?= htmlspecialchars($_POST['email'] ?? ($existingUsers[0]['email'] ?? 'admin@agendaweb.app')) ?>">
        </div>

        <div class="form-group">
          <label for="name">Display Name</label>
          <input type="text" id="name" name="name" placeholder="Administrator" value="<?= htmlspecialchars($_POST['name'] ?? ($existingUsers[0]['name'] ?? 'Administrator')) ?>">
        </div>

        <div class="form-group">
          <label for="password">New Password</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="password" name="password" placeholder="Enter your desired password" required minlength="6" value="AgendaAdmin2026!">
            <button type="button" class="fill-btn" style="white-space:nowrap; padding:0 12px;" onclick="generatePassword()">
              🎲 Random
            </button>
          </div>
          <p class="notice">Enter any password you want. It will be securely hashed with PHP bcrypt directly on your server.</p>
        </div>

        <div class="form-group">
          <label for="role">Role</label>
          <select id="role" name="role">
            <option value="admin" selected>Admin (Full control)</option>
            <option value="manager">Manager (Curation only)</option>
          </select>
        </div>

        <button type="submit" class="btn btn-primary" style="margin-top:8px;">
          💾 Set Password & Unlock Admin Access
        </button>
      </form>
    </div>

    <div class="alert alert-warning" style="font-size:0.83rem;">
      <strong>⚠️ Security Recommendation:</strong><br>
      Once you have successfully logged into the <a href="admin/index.html" style="font-weight:700; color:#92400e;">Admin Portal</a>, delete <code>reset_admin.php</code> from your Hostinger <code>public_html/</code> directory via File Manager to prevent unauthorized password resets.
    </div>

  <?php endif; ?>
</div>

<script>
  function populateEmail(email, name) {
    document.getElementById('email').value = email;
    if (name) document.getElementById('name').value = name;
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('password').value = pass;
  }
</script>

</body>
</html>
