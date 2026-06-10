<?php
// ============================================================
//  THE FOCUS CREW — Messages API
//
//  GET  ?action=list        → get all contact messages
//  POST ?action=add         → save a new contact message
//  POST ?action=mark_read   → mark all messages as read
// ============================================================
require_once 'config.php';

$action = $_GET['action'] ?? '';
$body   = getBody();
$db     = getDB();

// -------------------------------------------------------
// LIST ALL MESSAGES
// -------------------------------------------------------
if ($action === 'list') {
    $result   = $db->query("SELECT * FROM fc_messages ORDER BY created_at DESC");
    $messages = [];
    while ($row = $result->fetch_assoc()) {
        $messages[] = [
            'id'        => $row['id'],
            'name'      => $row['name'],
            'email'     => $row['email'],
            'phone'     => $row['phone']   ?? '',
            'service'   => $row['service'] ?? '',
            'message'   => $row['message'],
            'read'      => (bool) $row['is_read'],
            'createdAt' => str_replace(' ', 'T', $row['created_at']) . '+08:00',
        ];
    }
    respond(['success' => true, 'messages' => $messages]);
}

// -------------------------------------------------------
// ADD MESSAGE (from contact form)
// -------------------------------------------------------
if ($action === 'add') {
    $name    = trim($body['name']    ?? '');
    $email   = trim($body['email']   ?? '');
    $phone   = trim($body['phone']   ?? '');
    $service = trim($body['service'] ?? '');
    $message = trim($body['message'] ?? '');

    if (!$name || !$email || !$message) {
        respond(['success' => false, 'error' => 'Name, email, and message are required.'], 400);
    }

    $id   = 'msg_' . time() . rand(10, 99);
    $stmt = $db->prepare(
        "INSERT INTO fc_messages (id, name, email, phone, service, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())"
    );
    $stmt->bind_param('ssssss', $id, $name, $email, $phone, $service, $message);

    if (!$stmt->execute()) {
        respond(['success' => false, 'error' => 'Failed to save message.'], 500);
    }
    $stmt->close();

    respond(['success' => true, 'id' => $id]);
}

// -------------------------------------------------------
// MARK ALL AS READ
// -------------------------------------------------------
if ($action === 'mark_read') {
    $db->query("UPDATE fc_messages SET is_read = 1 WHERE is_read = 0");
    respond(['success' => true]);
}

// -------------------------------------------------------
// DELETE MESSAGE
// -------------------------------------------------------
if ($action === 'delete') {
    $id = trim($body['id'] ?? '');
    if (!$id) respond(['success' => false, 'error' => 'ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM fc_messages WHERE id = ?");
    $stmt->bind_param('s', $id);
    $stmt->execute();
    $stmt->close();

    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Invalid action.'], 400);
