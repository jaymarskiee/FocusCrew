<?php
// ============================================================
//  THE FOCUS CREW — Database Setup
//  Visit this file ONCE in your browser to create all tables.
//  URL: https://yoursite.infinityfreeapp.com/api/setup.php
//  ⚠️ DELETE THIS FILE after setup is complete!
// ============================================================
require_once 'config.php';

$db = getDB();

$errors = [];

// ── CREATE TABLES ────────────────────────────────────────────

$queries = [

    "CREATE TABLE IF NOT EXISTS fc_users (
        id             VARCHAR(40)  PRIMARY KEY,
        name           VARCHAR(100) NOT NULL,
        email          VARCHAR(150) NOT NULL UNIQUE,
        password       VARCHAR(255) NOT NULL,
        role           ENUM('admin','user') DEFAULT 'user',
        email_verified TINYINT(1)   DEFAULT 0,
        verify_token   VARCHAR(128) DEFAULT NULL,
        reset_token    VARCHAR(128) DEFAULT NULL,
        reset_expires  DATETIME     DEFAULT NULL,
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    "CREATE TABLE IF NOT EXISTS fc_bookings (
        id           VARCHAR(40)  PRIMARY KEY,
        client_name  VARCHAR(100) NOT NULL,
        email        VARCHAR(150) NOT NULL,
        phone        VARCHAR(30)  NOT NULL,
        service      VARCHAR(100) NOT NULL,
        shoot_date   DATE         NOT NULL,
        notes        TEXT,
        status       ENUM('pending','confirmed','done','cancelled') DEFAULT 'pending',
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    "CREATE TABLE IF NOT EXISTS fc_messages (
        id          VARCHAR(40)  PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) NOT NULL,
        phone       VARCHAR(30),
        service     VARCHAR(100),
        message     TEXT         NOT NULL,
        is_read     TINYINT(1)   DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
;

if (!$db->query($adminSql)) {
    $errors[] = $db->error;
}

$db->close();
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Focus Crew – DB Setup</title>
    <style>
        body { font-family: sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; }
        h2   { margin-bottom: 10px; }
        code { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; }
        .ok  { color: green; }
        .err { color: red; }
        .warn { background: #fff3cd; padding: 16px; border-radius: 8px; margin-top: 24px; }
    </style>
</head>
<body>

<?php if (empty($errors)): ?>
    <h2 class="ok">✅ Database Setup Complete!</h2>
    <p>All tables were created (or already exist). Missing columns were added automatically.</p>
    <hr>
    <p><strong>Default Admin Login:</strong></p>
    <p>Email: <code>admin@focuscrew.com</code></p>
    <p>Password: <code>admin123</code></p>
    <div class="warn">
        <strong>⚠️ IMPORTANT: Delete this file now!</strong><br>
        Go to your InfinityFree File Manager &rarr; <code>api/</code> folder &rarr; delete <code>setup.php</code>.<br>
        Leaving it online is a security risk.
    </div>
<?php else: ?>
    <h2 class="err">&#10060; Setup encountered errors</h2>
    <p>The following errors occurred:</p>
    <?php foreach ($errors as $e): ?>
        <p class="err">&bull; <?= htmlspecialchars($e) ?></p>
    <?php endforeach; ?>
    <p>Check your <code>api/config.php</code> and make sure your DB credentials are correct.</p>
<?php endif; ?>

</body>
</html>
