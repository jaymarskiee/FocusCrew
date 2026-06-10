<?php
// ============================================================
//  THE FOCUS CREW — Email Verification
//  Strategy: verify DB → PHP redirect to index.html with
//  user data encoded in URL hash so JS can set localStorage
// ============================================================
require_once 'config.php';

$token = trim($_GET['token'] ?? '');

if (!$token) {
    showErrorPage('Missing verification token.');
    exit();
}

$db = getDB();

$stmt = $db->prepare(
    "SELECT id, name, email, role, email_verified FROM fc_users WHERE verify_token = ? LIMIT 1"
);
$stmt->bind_param('s', $token);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {
    showErrorPage('Invalid or expired verification link. Please request a new one from the login page.');
    exit();
}

if ($user['email_verified']) {
    // Already verified — just redirect to index as logged in
    $safe = [
        'id'            => $user['id'],
        'name'          => $user['name'],
        'email'         => $user['email'],
        'role'          => $user['role'] ?? 'user',
        'emailVerified' => true,
    ];
    $db->close();
    redirectToHome($safe);
    exit();
}

// Mark as verified, clear the token
$stmt = $db->prepare(
    "UPDATE fc_users SET email_verified = 1, verify_token = NULL WHERE id = ?"
);
$stmt->bind_param('s', $user['id']);
$stmt->execute();
$stmt->close();
$db->close();

$safe = [
    'id'            => $user['id'],
    'name'          => $user['name'],
    'email'         => $user['email'],
    'role'          => $user['role'] ?? 'user',
    'emailVerified' => true,
];

redirectToHome($safe);

// -------------------------------------------------------
// Redirect to index.html with user data in URL fragment
// index.html will read it, set localStorage, then clean URL
// -------------------------------------------------------
function redirectToHome(array $userData): void {
    $encoded = urlencode(base64_encode(json_encode($userData)));
    // Detect base URL dynamically
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'];
    // Strip /api/verify.php from path to get root
    $root   = rtrim(str_replace('/api/verify.php', '', $_SERVER['PHP_SELF']), '/');
    $url    = $scheme . '://' . $host . $root . '/index.html?verified=1#fc_user=' . $encoded;
    header('Location: ' . $url, true, 302);
    exit();
}

// -------------------------------------------------------
// Simple error page (only shown when token is bad)
// -------------------------------------------------------
function showErrorPage(string $msg): void {
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verification Failed – The Focus Crew</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Poppins', sans-serif;
      background: #0f0f0f;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1a1a1a;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,.5);
    }
    .icon { font-size: 3.5rem; margin-bottom: 16px; }
    h2   { font-size: 1.5rem; font-weight: 700; margin-bottom: 12px; color: #e74c3c; }
    p    { color: #aaa; line-height: 1.6; margin-bottom: 28px; }
    a.btn {
      display: inline-block;
      padding: 12px 28px;
      background: transparent;
      border: 2px solid #fff;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: .9rem;
      letter-spacing: .5px;
      text-transform: uppercase;
      transition: background .2s, color .2s;
    }
    a.btn:hover { background: #fff; color: #000; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h2>Verification Failed</h2>
    <p><?= htmlspecialchars($msg) ?></p>
    <a href="../login.html" class="btn">Go to Login</a>
  </div>
</body>
</html>
    <?php
    exit();
}
