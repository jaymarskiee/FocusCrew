<?php
// ============================================================
//  THE FOCUS CREW — Database Configuration
//  Fill in your InfinityFree MySQL credentials below
// ============================================================

define('DB_HOST', 'sql306.infinityfree.com');      // ← from your InfinityFree panel
define('DB_USER', 'if0_41396516');                 // ← your MySQL username
define('DB_PASS', 'ilovegusela123');               // ← your MySQL password
define('DB_NAME', 'if0_41396516_focuscrew_db');    // ← your database name

// ── Timezone: Always use Philippine Standard Time (UTC+8) ──
date_default_timezone_set('Asia/Manila');

// CORS headers — allow requests from your HTML pages
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle browser preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Create and return a MySQL connection
function getDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $conn->connect_error]);
        exit();
    }
    $conn->set_charset('utf8mb4');
    // Force MySQL session to Philippine Standard Time (UTC+8)
    $conn->query("SET time_zone = '+08:00'");
    return $conn;
}

// Send a JSON response and stop execution
function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

// Read JSON body from POST request
function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}
