<?php
// ============================================================
//  THE FOCUS CREW — Bookings API
//
//  GET  ?action=list            → get all bookings
//  POST ?action=add             → submit a new booking
//  POST ?action=update_status   → change booking status
//  POST ?action=delete          → delete a booking
// ============================================================
require_once 'config.php';

$action = $_GET['action'] ?? '';
$body   = getBody();
$db     = getDB();

// -------------------------------------------------------
// LIST ALL BOOKINGS
// -------------------------------------------------------
if ($action === 'list') {
    $result   = $db->query("SELECT * FROM fc_bookings ORDER BY created_at DESC");
    $bookings = [];
    while ($row = $result->fetch_assoc()) {
        $bookings[] = [
            'id'         => $row['id'],
            'clientName' => $row['client_name'],
            'email'      => $row['email'],
            'phone'      => $row['phone'],
            'service'    => $row['service'],
            'date'       => $row['shoot_date'],
            'notes'      => $row['notes'] ?? '',
            'status'     => $row['status'],
            'createdAt'  => str_replace(' ', 'T', $row['created_at']) . '+08:00',
        ];
    }
    respond(['success' => true, 'bookings' => $bookings]);
}

// -------------------------------------------------------
// ADD NEW BOOKING
// -------------------------------------------------------
if ($action === 'add') {
    $clientName = trim($body['clientName'] ?? '');
    $email      = trim($body['email']      ?? '');
    $phone      = trim($body['phone']      ?? '');
    $service    = trim($body['service']    ?? '');
    $date       = trim($body['date']       ?? '');
    $notes      = trim($body['notes']      ?? '');

    if (!$clientName || !$email || !$phone || !$service || !$date) {
        respond(['success' => false, 'error' => 'All required fields must be filled.'], 400);
    }

    $id   = 'BK' . date('ymd') . rand(100, 999);
    $stmt = $db->prepare(
        "INSERT INTO fc_bookings (id, client_name, email, phone, service, shoot_date, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())"
    );
    $stmt->bind_param('sssssss', $id, $clientName, $email, $phone, $service, $date, $notes);

    if (!$stmt->execute()) {
        respond(['success' => false, 'error' => 'Failed to save booking.'], 500);
    }
    $stmt->close();

    // Send confirmation emails (to client + owner)
    $bookingData = [
        'id'         => $id,
        'clientName' => $clientName,
        'email'      => $email,
        'phone'      => $phone,
        'service'    => $service,
        'date'       => $date,
        'notes'      => $notes,
        'status'     => 'pending',
        'createdAt'  => date('F j, Y g:i A'),
    ];
    require_once __DIR__ . '/mailer.php';
    sendBookingConfirmationToClient($bookingData);
    sendBookingNotificationToOwner($bookingData);

    respond(['success' => true, 'booking' => [
        'id'         => $id,
        'clientName' => $clientName,
        'email'      => $email,
        'phone'      => $phone,
        'service'    => $service,
        'date'       => $date,
        'notes'      => $notes,
        'status'     => 'pending',
        'createdAt'  => date('Y-m-d\TH:i:sP'),
    ]]);
}

// -------------------------------------------------------
// UPDATE STATUS
// -------------------------------------------------------
if ($action === 'update_status') {
    $id      = trim($body['id']     ?? '');
    $status  = trim($body['status'] ?? '');
    $allowed = ['pending', 'confirmed', 'done', 'cancelled'];

    if (!$id || !in_array($status, $allowed)) {
        respond(['success' => false, 'error' => 'Invalid ID or status.'], 400);
    }

    $stmt = $db->prepare("UPDATE fc_bookings SET status = ? WHERE id = ?");
    $stmt->bind_param('ss', $status, $id);
    $stmt->execute();
    $stmt->close();

    respond(['success' => true]);
}

// -------------------------------------------------------
// DELETE BOOKING
// -------------------------------------------------------
if ($action === 'delete') {
    $id = trim($body['id'] ?? '');
    if (!$id) respond(['success' => false, 'error' => 'ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM fc_bookings WHERE id = ?");
    $stmt->bind_param('s', $id);
    $stmt->execute();
    $stmt->close();

    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Invalid action.'], 400);
