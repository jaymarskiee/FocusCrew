<?php
// ============================================================
//  THE FOCUS CREW — Users API  (with Email Verification)
//
//  GET  ?action=list           → list all users (admin)
//  POST ?action=login          → login (blocks unverified)
//  POST ?action=register       → create account + send verify email
//  GET  ?action=verify&token=  → verify email via token link
//  POST ?action=resend         → resend verification email
// ============================================================
require_once 'config.php';
require_once 'mailer.php';   // ← PHPMailer helper

$action = $_GET['action'] ?? '';
$body   = getBody();
$db     = getDB();

// -------------------------------------------------------
// LOGIN — block if not yet verified
// -------------------------------------------------------
if ($action === 'login') {
    $email    = trim($body['email']    ?? '');
    $password =      $body['password'] ?? '';

    if (!$email || !$password) {
        respond(['success' => false, 'error' => 'Email and password are required.'], 400);
    }

    $stmt = $db->prepare("SELECT * FROM fc_users WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user || !password_verify($password, $user['password'])) {
        respond(['success' => false, 'error' => 'Invalid email or password.'], 401);
    }

    // Block unverified users
    if (!$user['email_verified']) {
        respond([
            'success'    => false,
            'error'      => 'Please verify your email first. Check your inbox for the verification link.',
            'unverified' => true,   // ← frontend uses this flag to show "Resend" button
            'email'      => $email,
        ], 403);
    }

    unset($user['password'], $user['verify_token']);
    $user['createdAt'] = str_replace(' ', 'T', $user['created_at']) . '+08:00';
    unset($user['created_at']);

    respond(['success' => true, 'user' => $user]);
}

// -------------------------------------------------------
// REGISTER — save user (unverified) + send verify email
// -------------------------------------------------------
if ($action === 'register') {
    $name     = trim($body['name']     ?? '');
    $email    = trim($body['email']    ?? '');
    $password =      $body['password'] ?? '';

    if (!$name || !$email || !$password) {
        respond(['success' => false, 'error' => 'All fields are required.'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['success' => false, 'error' => 'Invalid email address.'], 400);
    }
    if (strlen($password) < 6) {
        respond(['success' => false, 'error' => 'Password must be at least 6 characters.'], 400);
    }

    // Check duplicate email
    $stmt = $db->prepare("SELECT id FROM fc_users WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    if ($stmt->get_result()->fetch_assoc()) {
        respond(['success' => false, 'error' => 'Email already registered.'], 409);
    }
    $stmt->close();

    // Generate a secure token (64 hex chars)
    $token = bin2hex(random_bytes(32));
    $id    = 'user_' . time() . rand(100, 999);
    $hash  = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare(
        "INSERT INTO fc_users (id, name, email, password, role, email_verified, verify_token, created_at)
         VALUES (?, ?, ?, ?, 'user', 0, ?, NOW())"
    );
    $stmt->bind_param('sssss', $id, $name, $email, $hash, $token);
    if (!$stmt->execute()) {
        respond(['success' => false, 'error' => 'Registration failed. Please try again.'], 500);
    }
    $stmt->close();

    // Send verification email
    $sent = sendVerificationEmail($email, $name, $token);

    if (!$sent) {
        // Still registered — just warn the user to request a resend
        respond([
            'success'  => true,
            'pending'  => true,
            'message'  => 'Account created! We could not send the verification email. Please use Resend below.',
        ]);
    }

    respond([
        'success' => true,
        'pending' => true,
        'message' => 'Account created! Please check your email (' . $email . ') and click the verification link before logging in.',
    ]);
}

// -------------------------------------------------------
// VERIFY — called when user clicks link in email
// -------------------------------------------------------
if ($action === 'verify') {
    $token = trim($_GET['token'] ?? '');

    if (!$token) {
        showVerifyPage(false, 'Missing verification token.');
    }

    $stmt = $db->prepare(
        "SELECT id, name, email_verified FROM fc_users WHERE verify_token = ? LIMIT 1"
    );
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        showVerifyPage(false, 'Invalid or expired verification link.');
    }

    if ($user['email_verified']) {
        showVerifyPage(true, 'Your email is already verified. You can log in.');
    }

    // Mark as verified, clear the token
    $stmt = $db->prepare(
        "UPDATE fc_users SET email_verified = 1, verify_token = NULL WHERE id = ?"
    );
    $stmt->bind_param('s', $user['id']);
    $stmt->execute();
    $stmt->close();

    // Fetch full user record to auto-login on the frontend
    $stmt = $db->prepare("SELECT id, name, email, role, created_at FROM fc_users WHERE id = ? LIMIT 1");
    $stmt->bind_param('s', $user['id']);
    $stmt->execute();
    $fullUser = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $db->close();

    if ($fullUser) {
        $fullUser['createdAt'] = str_replace(' ', 'T', $fullUser['created_at']) . '+08:00';
        unset($fullUser['created_at']);
        showVerifyPage(true, 'Email verified successfully! Redirecting you now…', $fullUser);
    }

    showVerifyPage(true, 'Email verified successfully! You can now log in.');
}

// -------------------------------------------------------
// RESEND — let user request a new verification email
// -------------------------------------------------------
if ($action === 'resend') {
    $email = trim($body['email'] ?? '');

    if (!$email) {
        respond(['success' => false, 'error' => 'Email is required.'], 400);
    }

    $stmt = $db->prepare(
        "SELECT id, name, email_verified FROM fc_users WHERE email = ? LIMIT 1"
    );
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        // Don't reveal whether the email exists
        respond(['success' => true, 'message' => 'If that email is registered, a new link was sent.']);
    }

    if ($user['email_verified']) {
        respond(['success' => false, 'error' => 'This email is already verified.']);
    }

    // Generate a fresh token
    $newToken = bin2hex(random_bytes(32));
    $stmt = $db->prepare("UPDATE fc_users SET verify_token = ? WHERE id = ?");
    $stmt->bind_param('ss', $newToken, $user['id']);
    $stmt->execute();
    $stmt->close();

    sendVerificationEmail($email, $user['name'], $newToken);

    respond(['success' => true, 'message' => 'Verification email resent! Please check your inbox.']);
}

// -------------------------------------------------------
// LIST (admin use)
// -------------------------------------------------------
if ($action === 'list') {
    $result = $db->query(
        "SELECT id, name, email, role, email_verified, created_at FROM fc_users ORDER BY created_at DESC"
    );
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $row['createdAt']      = str_replace(' ', 'T', $row['created_at']) . '+08:00';
        $row['emailVerified']  = (bool)$row['email_verified'];
        unset($row['created_at'], $row['email_verified']);
        $users[] = $row;
    }
    respond(['success' => true, 'users' => $users]);
}

// -------------------------------------------------------
// DELETE USER (admin use)
// -------------------------------------------------------
if ($action === 'delete') {
    $id = trim($body['id'] ?? '');
    if (!$id) respond(['success' => false, 'error' => 'ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM fc_users WHERE id = ?");
    $stmt->bind_param('s', $id);
    $stmt->execute();
    $stmt->close();

    respond(['success' => true]);
}


// -------------------------------------------------------
// FORGOT PASSWORD — send reset link to email
// -------------------------------------------------------
if ($action === 'forgot') {
    $email = trim($body['email'] ?? '');

    if (!$email) {
        respond(['success' => false, 'error' => 'Email is required.'], 400);
    }

    $stmt = $db->prepare("SELECT id, name, email_verified FROM fc_users WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Always respond success to avoid email enumeration
    if (!$user) {
        respond(['success' => true, 'message' => 'If that email is registered, a reset link has been sent.']);
    }

    // Generate reset token (expires in 1 hour)
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Store token — uses ALTER-safe approach (try UPDATE, if column missing catch error)
    $stmt = $db->prepare(
        "UPDATE fc_users SET reset_token = ?, reset_expires = ? WHERE id = ?"
    );
    if (!$stmt) {
        // Column doesn't exist yet — run migration then retry
        $db->query("ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128) DEFAULT NULL");
        $db->query("ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS reset_expires DATETIME DEFAULT NULL");
        $stmt = $db->prepare("UPDATE fc_users SET reset_token = ?, reset_expires = ? WHERE id = ?");
    }
    $stmt->bind_param('sss', $token, $expires, $user['id']);
    $stmt->execute();
    $stmt->close();

    require_once __DIR__ . '/mailer.php';
    sendPasswordResetEmail($email, $user['name'], $token);

    respond(['success' => true, 'message' => 'If that email is registered, a reset link has been sent.']);
}

// -------------------------------------------------------
// RESET PASSWORD — set new password using token
// -------------------------------------------------------
if ($action === 'reset') {
    $token    = trim($body['token']    ?? '');
    $password = trim($body['password'] ?? '');

    if (!$token || !$password) {
        respond(['success' => false, 'error' => 'Token and new password are required.'], 400);
    }
    if (strlen($password) < 6) {
        respond(['success' => false, 'error' => 'Password must be at least 6 characters.'], 400);
    }

    $stmt = $db->prepare(
        "SELECT id FROM fc_users WHERE reset_token = ? AND reset_expires > NOW() LIMIT 1"
    );
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        respond(['success' => false, 'error' => 'Reset link is invalid or has expired.'], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare(
        "UPDATE fc_users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?"
    );
    $stmt->bind_param('ss', $hash, $user['id']);
    $stmt->execute();
    $stmt->close();

    respond(['success' => true, 'message' => 'Password updated! You can now log in.']);
}

respond(['success' => false, 'error' => 'Invalid action.'], 400);
// -------------------------------------------------------
function showVerifyPage(bool $ok, string $msg, ?array $user = null): void {
    $icon  = $ok ? '✅' : '❌';
    $color = $ok ? '#2ecc71' : '#e74c3c';
    $title = $ok ? 'Email Verified' : 'Verification Failed';
    $userJson = $user ? json_encode($user) : 'null';
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= htmlspecialchars($title) ?> – The Focus Crew</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Poppins',sans-serif;background:#0f0f0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{background:#1a1a1a;border-radius:16px;padding:48px 40px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.5)}
    .icon{font-size:3.5rem;margin-bottom:16px}
    h2{font-size:1.5rem;font-weight:700;margin-bottom:12px;color:<?= $color ?>}
    p{color:#aaa;line-height:1.6;margin-bottom:28px}
    a.btn{display:inline-block;padding:12px 28px;background:#1a1a1a;border:2px solid #fff;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem;letter-spacing:.5px;text-transform:uppercase;transition:background .2s}
    a.btn:hover{background:#fff;color:#000}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon"><?= $icon ?></div>
    <h2><?= htmlspecialchars($title) ?></h2>
    <p><?= htmlspecialchars($msg) ?></p>
    <a href="../login.html" class="btn">Go to Login</a>
  </div>
  <script>
    (function () {
      var userData = <?= $userJson ?>;
      if (userData) {
        try {
          localStorage.setItem('fc_session', JSON.stringify(userData));
          setTimeout(function () {
            window.location.href = '../index.html';
          }, 1500);
        } catch (e) { /* localStorage blocked — user clicks button manually */ }
      }
    })();
  </script>
</body>
</html>
    <?php
    exit();
}
