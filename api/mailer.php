<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
// ============================================================
//  THE FOCUS CREW — Email Sender (via Gmail SMTP + PHPMailer)
//
//  ⚙️  SETUP STEPS:
//  1. Download PHPMailer from: https://github.com/PHPMailer/PHPMailer
//     → Download the ZIP → extract the "src" folder
//     → Upload the entire "src" folder to your server at: api/PHPMailer/src/
//
//  2. Create a Gmail App Password:
//     → Google Account → Security → 2-Step Verification (enable it first)
//     → Then: Security → App Passwords → Select app: Mail → Generate
//     → Copy the 16-character password (e.g. "abcd efgh ijkl mnop")
//
//  3. Fill in your details below (MAIL_FROM, MAIL_NAME, MAIL_USER, MAIL_PASS)
//
//  4. Update SITE_URL to match your InfinityFree domain
// ============================================================

// ── Your Gmail credentials ──────────────────────────────────
defined('MAIL_FROM') || define('MAIL_FROM',  'jaymargusela123@gmail.com');
defined('MAIL_NAME') || define('MAIL_NAME',  'The Focus Crew');
defined('MAIL_USER') || define('MAIL_USER',  'jaymargusela123@gmail.com');
defined('MAIL_PASS') || define('MAIL_PASS',  'gbhe xpdl cvzk auyo');

// ── Your site URL (no trailing slash) ───────────────────────
defined('SITE_URL')  || define('SITE_URL',   'https://focuscrew.free.nf');

// ── Load PHPMailer ───────────────────────────────────────────
require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

// ── Owner email — receives all new booking notifications ────
defined('OWNER_EMAIL') || define('OWNER_EMAIL', 'jaymargusela123@gmail.com');
defined('OWNER_NAME')  || define('OWNER_NAME',  'Jaymar – The Focus Crew');

/**
 * Sends a booking confirmation receipt to the CLIENT.
 */
function sendBookingConfirmationToClient(array $b): bool {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USER;
        $mail->Password   = MAIL_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom(MAIL_FROM, MAIL_NAME);
        $mail->addAddress($b['email'], $b['clientName']);

        $mail->isHTML(true);
        $mail->Subject = '📸 Booking Received – ' . $b['id'] . ' | The Focus Crew';
        $mail->Body    = buildClientBookingHTML($b);
        $mail->AltBody = buildBookingPlainText($b, false);

        $mail->send();
        return true;
    } catch (\Exception $e) {
        error_log('PHPMailer (client booking): ' . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Sends a new booking notification to the OWNER.
 */
function sendBookingNotificationToOwner(array $b): bool {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USER;
        $mail->Password   = MAIL_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom(MAIL_FROM, MAIL_NAME);
        $mail->addAddress(OWNER_EMAIL, OWNER_NAME);
        // Reply-To set to client so owner can reply directly
        $mail->addReplyTo($b['email'], $b['clientName']);

        $mail->isHTML(true);
        $mail->Subject = '🔔 New Booking: ' . $b['clientName'] . ' – ' . $b['id'];
        $mail->Body    = buildOwnerBookingHTML($b);
        $mail->AltBody = buildBookingPlainText($b, true);

        $mail->send();
        return true;
    } catch (\Exception $e) {
        error_log('PHPMailer (owner booking): ' . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Shared receipt rows HTML used by both email templates.
 */
function bookingReceiptRows(array $b): string {
    $rows = [
        ['📋 Booking ID',   $b['id']],
        ['👤 Client Name',  $b['clientName']],
        ['✉️ Email',         $b['email']],
        ['📞 Phone',         $b['phone']],
        ['📷 Service',       $b['service']],
        ['📅 Shoot Date',    $b['date']],
        ['📝 Notes',         $b['notes'] ?: '—'],
        ['🔖 Status',        strtoupper($b['status'])],
        ['🕐 Submitted',     $b['createdAt']],
    ];
    $html = '';
    foreach ($rows as [$label, $value]) {
        $safeVal = htmlspecialchars((string)$value);
        $html .= "
        <tr>
          <td style=\"padding:10px 16px;color:#888;font-size:.82rem;white-space:nowrap;border-bottom:1px solid #222;\">$label</td>
          <td style=\"padding:10px 16px;color:#eee;font-size:.85rem;font-weight:600;border-bottom:1px solid #222;word-break:break-word;\">$safeVal</td>
        </tr>";
    }
    return $html;
}

/**
 * Booking confirmation email HTML for the CLIENT.
 */
function buildClientBookingHTML(array $b): string {
    $name  = htmlspecialchars($b['clientName']);
    $id    = htmlspecialchars($b['id']);
    $rows  = bookingReceiptRows($b);

    // QR code image of the booking ID
    $qrData = urlencode("THE FOCUS CREW - BOOKING RECEIPT\nBooking ID: {$b['id']}\nName: {$b['clientName']}\nEmail: {$b['email']}\nPhone: {$b['phone']}\nService: {$b['service']}\nDate: {$b['date']}\nStatus: " . strtoupper($b['status']) . "\nBooked: {$b['createdAt']}");
    $qrUrl  = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=$qrData";

    return <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">

  <!-- Header -->
  <div style="background:#000;padding:28px 32px;text-align:center;border-bottom:2px solid #F5A623;">
    <div style="font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:3px;">THE <span style="color:#F5A623;">FOCUS</span> CREW</div>
    <div style="color:#888;font-size:.75rem;margin-top:4px;">FC's Photography Services · Bohol, Philippines</div>
    <div style="margin-top:14px;display:inline-block;background:#F5A623;color:#111;font-weight:800;font-size:.78rem;padding:4px 18px;border-radius:20px;letter-spacing:1px;">BOOKING RECEIPT</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">
    <p style="color:#eee;font-size:.95rem;margin:0 0 8px;">Hi <strong style="color:#F5A623;">$name</strong>,</p>
    <p style="color:#aaa;font-size:.88rem;line-height:1.7;margin:0 0 24px;">
      We have received your booking request! Here are your booking details. We will confirm your appointment within <strong style="color:#eee;">24 hours</strong> via email or phone.
    </p>

    <!-- Receipt table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#111;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      $rows
    </table>

    <!-- QR Code -->
    <div style="text-align:center;padding:16px 0;">
      <div style="color:#888;font-size:.72rem;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Your Booking QR Code</div>
      <div style="display:inline-block;background:#fff;padding:10px;border-radius:10px;">
        <img src="$qrUrl" width="160" height="160" alt="Booking QR Code" style="display:block;" />
      </div>
      <div style="color:#555;font-size:.72rem;margin-top:8px;">Show this QR on your shoot day</div>
    </div>

    <!-- Note -->
    <div style="background:#1a1a0e;border:1px solid #3a3a1a;border-radius:8px;padding:14px;text-align:center;margin-top:8px;">
      <p style="color:#aaa;font-size:.8rem;line-height:1.6;margin:0;">
        ⏳ Confirmation within <strong style="color:#F5A623;">24 hours</strong><br>
        📞 <a href="tel:09813924006" style="color:#F5A623;text-decoration:none;">09813924006</a> &nbsp;·&nbsp;
        ✉️ <a href="mailto:jaymargusela123@gmail.com" style="color:#F5A623;text-decoration:none;">jaymargusela123@gmail.com</a>
      </p>
    </div>
  </div>

  <div style="background:#111;padding:16px 32px;text-align:center;color:#555;font-size:.75rem;">
    © The Focus Crew · Bohol, Philippines
  </div>
</div>
</body></html>
HTML;
}

/**
 * New booking notification email HTML for the OWNER.
 */
function buildOwnerBookingHTML(array $b): string {
    $name  = htmlspecialchars($b['clientName']);
    $id    = htmlspecialchars($b['id']);
    $rows  = bookingReceiptRows($b);

    return <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">

  <!-- Header -->
  <div style="background:#000;padding:28px 32px;text-align:center;border-bottom:2px solid #F5A623;">
    <div style="font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:3px;">THE <span style="color:#F5A623;">FOCUS</span> CREW</div>
    <div style="color:#888;font-size:.75rem;margin-top:4px;">Admin Notification</div>
    <div style="margin-top:14px;display:inline-block;background:#F5A623;color:#111;font-weight:800;font-size:.78rem;padding:4px 18px;border-radius:20px;letter-spacing:1px;">🔔 NEW BOOKING</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">
    <p style="color:#eee;font-size:.95rem;margin:0 0 8px;">Bagong booking ang dumating!</p>
    <p style="color:#aaa;font-size:.88rem;line-height:1.7;margin:0 0 24px;">
      Si <strong style="color:#F5A623;">$name</strong> ay nag-submit ng booking request. I-review at i-confirm sa iyong Admin Dashboard.
    </p>

    <!-- Receipt table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#111;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      $rows
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-top:8px;">
      <a href="https://focuscrew.free.nf/admin.html" style="display:inline-block;padding:14px 32px;background:#F5A623;color:#111;border-radius:8px;text-decoration:none;font-weight:800;font-size:.88rem;letter-spacing:.5px;">
        Go to Admin Dashboard →
      </a>
    </div>
  </div>

  <div style="background:#111;padding:16px 32px;text-align:center;color:#555;font-size:.75rem;">
    © The Focus Crew · Bohol, Philippines
  </div>
</div>
</body></html>
HTML;
}

/**
 * Plain-text fallback for both emails.
 */
function buildBookingPlainText(array $b, bool $isOwner): string {
    $intro = $isOwner
        ? "Bagong booking mula kay {$b['clientName']}!"
        : "Hi {$b['clientName']}, natanggap na namin ang iyong booking!";

    return <<<TXT
THE FOCUS CREW
$intro

Booking ID : {$b['id']}
Name       : {$b['clientName']}
Email      : {$b['email']}
Phone      : {$b['phone']}
Service    : {$b['service']}
Shoot Date : {$b['date']}
Notes      : {$b['notes']}
Status     : {$b['status']}
Submitted  : {$b['createdAt']}

– The Focus Crew | Bohol, Philippines
TXT;
}


/**
 * Sends a password reset email.
 */
function sendPasswordResetEmail(string $toEmail, string $toName, string $token): bool {
    $link     = SITE_URL . '/reset-password.html?token=' . urlencode($token);
    $safeName = htmlspecialchars($toName);

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USER;
        $mail->Password   = MAIL_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom(MAIL_FROM, MAIL_NAME);
        $mail->addAddress($toEmail, $toName);

        $mail->isHTML(true);
        $mail->Subject = '🔑 Reset Your Password – The Focus Crew';
        $mail->Body    = <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
  <div style="background:#000;padding:28px 32px;text-align:center;border-bottom:2px solid #F5A623;">
    <div style="font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:3px;">THE <span style="color:#F5A623;">FOCUS</span> CREW</div>
    <div style="color:#888;font-size:.75rem;margin-top:4px;">FC's Photography Services · Bohol, Philippines</div>
    <div style="margin-top:14px;display:inline-block;background:#F5A623;color:#111;font-weight:800;font-size:.78rem;padding:4px 18px;border-radius:20px;letter-spacing:1px;">🔑 PASSWORD RESET</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#eee;font-size:.95rem;margin:0 0 8px;">Hi <strong style="color:#F5A623;">$safeName</strong>,</p>
    <p style="color:#aaa;font-size:.88rem;line-height:1.7;margin:0 0 24px;">
      We received a request to reset your password. Click the button below to set a new one. This link expires in <strong style="color:#eee;">1 hour</strong>.
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="$link" style="display:inline-block;padding:14px 32px;background:#F5A623;color:#111;border-radius:8px;text-decoration:none;font-weight:800;font-size:.9rem;letter-spacing:.5px;">
        Reset My Password
      </a>
    </div>
    <div style="background:#1a1a0e;border:1px solid #3a3a1a;border-radius:8px;padding:12px;text-align:center;">
      <p style="color:#aaa;font-size:.78rem;margin:0;line-height:1.6;">
        If you did not request this, you can safely ignore this email.<br>
        Your password will not change until you click the link above.
      </p>
    </div>
    <p style="color:#555;font-size:.72rem;margin-top:16px;word-break:break-all;">
      Or copy this link: <a href="$link" style="color:#F5A623;">$link</a>
    </p>
  </div>
  <div style="background:#111;padding:16px 32px;text-align:center;color:#555;font-size:.75rem;">
    © The Focus Crew · Bohol, Philippines
  </div>
</div>
</body></html>
HTML;
        $mail->AltBody = "Hi $toName,\n\nReset your password by visiting:\n$link\n\nThis link expires in 1 hour.\n\n– The Focus Crew";

        $mail->send();
        return true;
    } catch (\Exception $e) {
        error_log('PHPMailer (reset): ' . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Sends a verification email to a newly registered user.
 *
 * @param  string $toEmail  Recipient email address
 * @param  string $toName   Recipient's full name
 * @param  string $token    The 64-char hex verification token
 * @return bool             true on success, false on failure
 */
function sendVerificationEmail(string $toEmail, string $toName, string $token): bool {
    $link = SITE_URL . '/api/verify.php?token=' . urlencode($token);

    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_USER;
        $mail->Password   = MAIL_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        // From / To
        $mail->setFrom(MAIL_FROM, MAIL_NAME);
        $mail->addAddress($toEmail, $toName);

        // Content
        $mail->isHTML(true);
        $mail->Subject = 'Verify Your Email – The Focus Crew';
        $mail->Body    = buildEmailHTML($toName, $link);
        $mail->AltBody = "Hi $toName,\n\nPlease verify your email by visiting this link:\n$link\n\nThis link expires in 24 hours.\n\n– The Focus Crew";

        $mail->send();
        return true;

    } catch (Exception $e) {
        error_log('PHPMailer Error: ' . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Returns the HTML body of the verification email.
 */
function buildEmailHTML(string $name, string $link): string {
    $safeName = htmlspecialchars($name);
    return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body      { margin:0; padding:0; background:#0f0f0f; font-family:'Helvetica Neue',Arial,sans-serif; }
    .wrapper  { max-width:520px; margin:40px auto; background:#1a1a1a; border-radius:12px; overflow:hidden; }
    .header   { background:#000; padding:28px 32px; text-align:center; }
    .logo     { font-size:1.6rem; font-weight:900; color:#fff; letter-spacing:3px; text-transform:uppercase; }
    .logo span{ color:#c9a84c; }
    .body     { padding:36px 32px; }
    h2        { color:#fff; font-size:1.2rem; margin:0 0 12px; }
    p         { color:#aaa; font-size:.9rem; line-height:1.7; margin:0 0 20px; }
    .btn      { display:inline-block; padding:14px 32px; background:#c9a84c; color:#000 !important;
                border-radius:8px; text-decoration:none; font-weight:700; font-size:.9rem;
                letter-spacing:.5px; text-transform:uppercase; }
    .note     { color:#666 !important; font-size:.8rem; }
    .footer   { background:#111; padding:20px 32px; text-align:center; color:#555; font-size:.78rem; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">THE <span>FOCUS</span> CREW</div>
  </div>
  <div class="body">
    <h2>Verify Your Email Address</h2>
    <p>Hi <strong style="color:#fff;">$safeName</strong>,</p>
    <p>Thanks for registering! Click the button below to verify your email address and activate your account.</p>
    <p style="text-align:center;">
      <a href="$link" class="btn">Verify My Email</a>
    </p>
    <p class="note">This link expires in <strong style="color:#aaa;">24 hours</strong>. If you did not create an account, you can safely ignore this email.</p>
    <p class="note">If the button does not work, copy and paste this link into your browser:<br>
      <a href="$link" style="color:#c9a84c;word-break:break-all;font-size:.78rem;">$link</a>
    </p>
  </div>
  <div class="footer">© The Focus Crew · Bohol, Philippines</div>
</div>
</body>
</html>
HTML;
}
