<?php
// ============================================================
//  THE FOCUS CREW — File Upload API
//
//  GET  ?action=list     → list all uploaded files
//  POST ?action=upload   → upload a new file (multipart)
//  POST ?action=delete   → delete a file by id
// ============================================================
require_once 'config.php';

$action    = $_GET['action'] ?? '';
$db        = getDB();
$uploadDir = __DIR__ . '/../uploads/';   // physical path on server

// Make sure uploads folder exists
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// -------------------------------------------------------
// LIST FILES
// -------------------------------------------------------
if ($action === 'list') {
    $result = $db->query("SELECT * FROM fc_files ORDER BY uploaded_at DESC");
    $files  = [];
    while ($row = $result->fetch_assoc()) {
        $files[] = [
            'id'         => $row['id'],
            'name'       => $row['name'],
            'type'       => $row['type'],
            'size'       => (int) $row['size'],
            'url'        => 'uploads/' . basename($row['path']),
            'uploadedAt' => str_replace(' ', 'T', $row['uploaded_at']) . '+08:00',
        ];
    }
    respond(['success' => true, 'files' => $files]);
}

// -------------------------------------------------------
// UPLOAD FILE
// -------------------------------------------------------
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (empty($_FILES['file'])) {
        respond(['success' => false, 'error' => 'No file received.'], 400);
    }

    $file    = $_FILES['file'];
    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    $maxSize = 5 * 1024 * 1024; // 5 MB

    if (!in_array($file['type'], $allowed)) {
        respond(['success' => false, 'error' => 'File type not allowed. Use JPG, PNG, WEBP, GIF, or PDF.'], 400);
    }
    if ($file['size'] > $maxSize) {
        respond(['success' => false, 'error' => 'File too large. Maximum size is 5MB.'], 400);
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        respond(['success' => false, 'error' => 'Upload error code: ' . $file['error']], 500);
    }

    // Build a unique filename
    $id       = 'file_' . time() . rand(100, 999);
    $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $filename = $id . '.' . $ext;
    $dest     = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        respond(['success' => false, 'error' => 'Failed to save file on server.'], 500);
    }

    // Save metadata to DB
    $stmt = $db->prepare(
        "INSERT INTO fc_files (id, name, type, size, path, uploaded_at) VALUES (?, ?, ?, ?, ?, NOW())"
    );
    $size = $file['size'];
    $stmt->bind_param('sssds', $id, $file['name'], $file['type'], $size, $filename);
    $stmt->execute();
    $stmt->close();

    respond(['success' => true, 'file' => [
        'id'         => $id,
        'name'       => $file['name'],
        'type'       => $file['type'],
        'size'       => $file['size'],
        'url'        => 'uploads/' . $filename,
        'uploadedAt' => date('Y-m-d\TH:i:sP'),
    ]]);
}

// -------------------------------------------------------
// DELETE FILE
// -------------------------------------------------------
if ($action === 'delete') {
    $body = getBody();
    $id   = trim($body['id'] ?? '');
    if (!$id) respond(['success' => false, 'error' => 'ID required.'], 400);

    // Get file path first
    $stmt = $db->prepare("SELECT path FROM fc_files WHERE id = ?");
    $stmt->bind_param('s', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        // Delete physical file
        $filePath = $uploadDir . basename($row['path']);
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        // Delete DB record
        $stmt = $db->prepare("DELETE FROM fc_files WHERE id = ?");
        $stmt->bind_param('s', $id);
        $stmt->execute();
        $stmt->close();
    }

    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Invalid action.'], 400);
