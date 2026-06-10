// ============================================================
//  THE FOCUS CREW — admin.js  (MySQL / PHP API version)
//  All data fetched from /api/*.php using async/await
// ============================================================

/* ==========================================================
   SECTION 1 — SIDEBAR NAVIGATION
   ========================================================== */

function initAdminNav() {
  const links  = document.querySelectorAll('.sidebar-link');
  const panels = document.querySelectorAll('.admin-panel');

  function showPanel(id) {
    panels.forEach(p => p.classList.remove('active'));
    links.forEach(l => l.classList.remove('active'));
    document.getElementById('panel-' + id)?.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-panel="${id}"]`);
    link?.classList.add('active');
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl && link) titleEl.textContent = link.querySelector('.link-label')?.textContent || '';
  }

  links.forEach(link => {
    link.addEventListener('click', () => {
      const id = link.dataset.panel;
      if (id) showPanel(id);
    });
  });

  showPanel('dashboard');
}

/* ==========================================================
   SECTION 2 — DASHBOARD STATS
   ========================================================== */

async function renderDashboard() {
  const [bookings, messages] = await Promise.all([
    DB.getBookings(),
    DB.getMessages(),
  ]);

  const el    = id => document.getElementById(id);
  const count = (arr, key, val) => arr.filter(x => x[key] === val).length;

  if (el('stat-bookings'))  el('stat-bookings').textContent  = bookings.length;
  if (el('stat-pending'))   el('stat-pending').textContent   = count(bookings, 'status', 'pending');
  if (el('stat-messages'))  el('stat-messages').textContent  = messages.filter(m => !m.read).length;

  // Show last 5 bookings on dashboard
  renderBookingsTable(bookings.slice(0, 5), 'dashboard-bookings-tbody');
}

/* ==========================================================
   SECTION 3 — BOOKINGS TABLE
   ========================================================== */

let allBookings      = [];
let filteredBookings = [];
let currentPage      = 1;
const PAGE_SIZE      = 8;

async function renderAllBookings() {
  allBookings = await DB.getBookings();
  applyBookingFilters();
}

function applyBookingFilters() {
  const search = (document.getElementById('booking-search')?.value || '').toLowerCase();
  const status = document.getElementById('booking-filter-status')?.value || 'all';

  filteredBookings = allBookings.filter(b => {
    const matchSearch = !search
      || b.clientName?.toLowerCase().includes(search)
      || b.service?.toLowerCase().includes(search)
      || b.id?.toLowerCase().includes(search);
    const matchStatus = status === 'all' || b.status === status;
    return matchSearch && matchStatus;
  });

  currentPage = 1;
  renderPaginatedBookings();
}

function renderPaginatedBookings() {
  const start    = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredBookings.slice(start, start + PAGE_SIZE);
  renderBookingsTable(pageData);
  renderPagination(filteredBookings.length, 'bookings-pagination');
}

function renderBookingsTable(data, tbodyId = 'bookings-tbody') {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:32px;color:#aaa;">
          No bookings yet. <a href="index.html#booking" style="color:var(--yellow);">Create a test booking →</a>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = data.map(b => {
    const isConfirmed = b.status === 'confirmed';
    const isDone = b.status === 'done' || b.status === 'cancelled';
    return `
    <tr>
      <td><strong>${b.id}</strong></td>
      <td>${escHtml(b.clientName)}</td>
      <td>${escHtml(b.service)}</td>
      <td>${formatDate(b.date)}</td>
      <td><span class="status-badge status-${b.status}">${b.status}</span></td>
      <td>${formatDate(b.createdAt, true)}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          ${!isDone && !isConfirmed ? `
          <button class="btn btn-sm btn-primary"
                  onclick="updateStatus('${b.id}','confirmed')" title="Confirm">✓ Confirm</button>
          ` : ''}
          ${!isDone ? `
          <button class="btn btn-sm btn-dark"
                  onclick="updateStatus('${b.id}','done')" title="Mark Done">🏁 Done</button>
          ` : ''}
          <button class="btn btn-sm"
                  style="background:#dc2626;color:#fff;font-weight:700;border:none;cursor:pointer;border-radius:6px;padding:5px 10px;"
                  onclick="deleteBooking('${b.id}')" title="Delete Booking">🗑 Delete</button>
        </div>
      </td>
    </tr>
  `}).join('');
}

function renderPagination(total, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) { container.innerHTML = ''; return; }
  container.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map(i => `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`)
    .join('');
}

function goToPage(page) {
  currentPage = page;
  renderPaginatedBookings();
}

async function updateStatus(id, status) {
  const result = await DB.updateBookingStatus(id, status);
  if (result.success) {
    Toast.success(`Booking ${id} marked as ${status}.`);
    await renderAllBookings();
    await renderDashboard();
  } else {
    Toast.error('Failed to update status.');
  }
}

async function deleteBooking(id) {
  if (!confirm('Delete this booking? This cannot be undone.')) return;
  const result = await DB.deleteBooking(id);
  if (result.success) {
    Toast.success('Booking deleted.');
    await renderAllBookings();
    await renderDashboard();
  } else {
    Toast.error('Failed to delete booking.');
  }
}

async function deleteMessage(id) {
  if (!confirm('Delete this message? This cannot be undone.')) return;
  const result = await DB.deleteMessage(id);
  if (result.success) {
    Toast.success('Message deleted.');
    await renderMessages();
    await renderDashboard();
  } else {
    Toast.error('Failed to delete message.');
  }
}

async function deleteUser(id, role) {
  if (role === 'admin') {
    Toast.error('Cannot delete an admin account.');
    return;
  }
  if (!confirm('Delete this user? This cannot be undone.')) return;
  const result = await DB.deleteUser(id);
  if (result.success) {
    Toast.success('User deleted.');
    await renderUsers();
  } else {
    Toast.error('Failed to delete user.');
  }
}

function initBookingFilters() {
  document.getElementById('booking-search')?.addEventListener('input', applyBookingFilters);
  document.getElementById('booking-filter-status')?.addEventListener('change', applyBookingFilters);
}

/* ==========================================================
   SECTION 5 — QR SCANNER + BOOKING RECEIPT LOOKUP
   ========================================================== */

// Parse booking data from QR text (format written by main.js showReceiptModal)
// Handles both real newlines (\n) and literal "\n" strings from some QR decoders
function parseBookingQR(text) {
  // Normalize: replace literal "\n" strings and carriage returns
  const normalized = text.replace(/\\n/g, '\n').replace(/\r/g, '');
  const lines = normalized.split('\n');
  const get   = (prefix) => {
    const line = lines.find(l => l.trim().startsWith(prefix));
    return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : '';
  };
  return {
    id:         get('Booking ID: '),
    clientName: get('Name: '),
    email:      get('Email: '),
    phone:      get('Phone: '),
    service:    get('Service: '),
    date:       get('Date: '),
    status:     (get('Status: ') || 'pending').toLowerCase(),
    createdAt:  get('Booked: '),
  };
}

// Extract booking ID from raw QR text using multiple strategies
function extractBookingId(text) {
  if (!text) return null;

  // Strategy 1: Multiline format — look for "Booking ID: XXXXX"
  const normalized = text.replace(/\\n/g, '\n').replace(/\r/g, '');
  const idMatch = normalized.match(/Booking ID:\s*([A-Za-z0-9_-]+)/i);
  if (idMatch) return idMatch[1].trim();

  // Strategy 2: Plain booking ID pattern (e.g. BK250415123)
  const plainMatch = text.trim().match(/^(BK[A-Za-z0-9_-]+)$/i);
  if (plainMatch) return plainMatch[1].trim();

  // Strategy 3: The entire text might just be the booking ID
  const clean = text.trim();
  if (/^[A-Za-z0-9_-]{4,30}$/.test(clean)) return clean;

  return null;
}

// Render the receipt card inline inside the QR panel
function renderQRReceipt(booking) {
  const area    = document.getElementById('qr-receipt-area');
  const content = document.getElementById('qr-receipt-content');
  if (!area || !content) return;

  if (!booking || !booking.id) {
    content.innerHTML = `
      <div style="background:#1a1a1a; border:1px solid #dc2626; border-radius:12px; padding:28px; text-align:center; color:#dc2626;">
        ❌ <strong>Booking not found.</strong><br>
        <span style="color:#888; font-size:0.85rem;">No booking matched that ID or QR code.</span>
      </div>`;
    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const fmt = (d) => {
    if (!d) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y,m,dd] = d.split('-').map(Number);
      return new Date(y, m-1, dd).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });
    }
    let n = d;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(d)) n = d.replace(' ','T') + '+08:00';
    const dt = new Date(n);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Manila' });
  };

  const fmtDt = (d) => {
    if (!d) return '—';
    let n = d;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(d)) n = d.replace(' ','T') + '+08:00';
    const dt = new Date(n);
    return isNaN(dt) ? d : dt.toLocaleString('en-PH', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Manila' });
  };

  const statusColors = {
    confirmed: { bg:'#1e3a1e', color:'#4caf50', border:'#4caf50' },
    pending:   { bg:'#3a2e00', color:'#f5a623', border:'#f5a623' },
    done:      { bg:'#1a2a3a', color:'#4fc3f7', border:'#4fc3f7' },
    cancelled: { bg:'#3a1a1a', color:'#ef5350', border:'#ef5350' },
  };
  const sc = statusColors[booking.status] || statusColors.pending;

  const qrContent = [
    'THE FOCUS CREW - BOOKING RECEIPT',
    'Booking ID: ' + booking.id,
    'Name: ' + booking.clientName,
    'Email: ' + booking.email,
    'Phone: ' + booking.phone,
    'Service: ' + booking.service,
    'Date: ' + booking.date,
    'Status: ' + (booking.status || '').toUpperCase(),
    'Booked: ' + (booking.createdAt || ''),
  ].join('\n');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(qrContent);

  const rows = [
    ['👤 Client',    booking.clientName],
    ['✉️ Email',     booking.email],
    ['📞 Phone',     booking.phone],
    ['📷 Service',   booking.service],
    ['📅 Shoot Date',fmt(booking.date)],
    ['🕐 Booked On', fmtDt(booking.createdAt)],
  ];

  content.innerHTML = `
    <div id="qr-receipt-card" style="
      background:#111; border:1px solid #333; border-radius:16px;
      max-width:520px; margin:0 auto;
      font-family:'Segoe UI',sans-serif; color:#eee;
      box-shadow:0 8px 40px rgba(0,0,0,0.6);
    ">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a); padding:24px; border-radius:16px 16px 0 0; text-align:center; border-bottom:2px solid #F5A623;">
        <div style="font-size:2.2rem; margin-bottom:4px;">📸</div>
        <div style="color:#F5A623; font-weight:900; font-size:1.15rem; letter-spacing:3px;">THE FOCUS CREW</div>
        <div style="color:#888; font-size:0.73rem; margin-top:2px;">FC's Photography Services · Bohol, Philippines</div>
        <div style="margin-top:12px; display:inline-block; background:#F5A623; color:#111; font-weight:800; font-size:0.78rem; padding:4px 20px; border-radius:20px; letter-spacing:1.5px;">
          BOOKING RECEIPT
        </div>
      </div>

      <!-- Booking ID & Status -->
      <div style="padding:18px 24px 0; text-align:center;">
        <div style="color:#888; font-size:0.7rem; letter-spacing:1.5px; text-transform:uppercase;">Booking Reference</div>
        <div style="font-size:1.7rem; font-weight:900; color:#F5A623; letter-spacing:4px; margin-top:4px;">${escHtml(booking.id)}</div>
        <div style="display:inline-block; background:${sc.bg}; color:${sc.color}; border:1px solid ${sc.border};
                    font-size:0.72rem; padding:3px 16px; border-radius:12px; margin-top:8px;
                    font-weight:700; letter-spacing:1px; text-transform:uppercase;">
          ● ${escHtml(booking.status)}
        </div>
      </div>

      <div style="margin:16px 24px; border-top:1px dashed #333;"></div>

      <!-- Details -->
      <div style="padding:0 24px;">
        ${rows.map(([label, val]) => `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:9px 0; border-bottom:1px solid #1e1e1e;">
            <span style="color:#888; font-size:0.8rem; min-width:110px;">${label}</span>
            <span style="font-size:0.88rem; font-weight:600; text-align:right; max-width:280px; word-break:break-word;">${escHtml(String(val || '—'))}</span>
          </div>
        `).join('')}
      </div>

      <div style="margin:16px 24px 0; border-top:1px dashed #333;"></div>

      <!-- QR Code -->
      <div style="padding:16px 24px; text-align:center;">
        <div style="color:#888; font-size:0.7rem; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;">Booking QR Code</div>
        <div style="display:inline-block; background:#fff; padding:10px; border-radius:10px;">
          <img src="${qrUrl}" alt="Booking QR" width="160" height="160" style="display:block;"
               onerror="this.parentElement.innerHTML='<div style=color:#888;font-size:0.75rem;padding:20px>QR unavailable offline</div>'" />
        </div>
        <div style="color:#555; font-size:0.7rem; margin-top:8px;">Scan to verify this booking</div>
      </div>

      <!-- Note -->
      <div style="margin:0 24px 16px; background:#1a1a0e; border:1px solid #3a3a1a; border-radius:8px; padding:12px; text-align:center;">
        <div style="font-size:0.78rem; color:#aaa; line-height:1.6;">
          ⏳ Bookings are confirmed within <strong style="color:#F5A623;">24 hours</strong> via email or phone.<br>
          📞 <a href="tel:09813924006" style="color:#F5A623; text-decoration:none;">09813924006</a>
        </div>
      </div>

      <!-- Actions -->
      <div style="padding:0 24px 24px; display:flex; gap:10px; flex-wrap:wrap;">
        <button onclick="printQRReceipt()" style="
          flex:1; background:#F5A623; color:#111; border:none; border-radius:8px;
          padding:12px; font-weight:800; font-size:0.85rem; cursor:pointer; letter-spacing:1px;">
          🖨️ PRINT RECEIPT
        </button>
        <button onclick="document.getElementById('qr-receipt-area').style.display='none';" style="
          flex:1; background:#1e1e1e; color:#eee; border:1px solid #333; border-radius:8px;
          padding:12px; font-weight:700; font-size:0.85rem; cursor:pointer;">
          ✕ Close
        </button>
      </div>
    </div>
  `;

  area.style.display = 'block';
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function printQRReceipt() {
  const card = document.getElementById('qr-receipt-card');
  if (!card) return;
  const printWin = window.open('', '_blank', 'width=560,height=800');
  printWin.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Booking Receipt – The Focus Crew</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#fff;font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:20px}
      .wrap{max-width:440px;margin:auto;border:2px solid #F5A623;border-radius:12px;overflow:hidden}
      .hdr{background:#1a1a1a;color:#F5A623;text-align:center;padding:20px}
      .hdr h1{font-size:1rem;letter-spacing:2px}
      .hdr p{font-size:0.72rem;color:#aaa;margin-top:2px}
      .badge{display:inline-block;background:#F5A623;color:#111;font-weight:800;font-size:0.75rem;padding:3px 14px;border-radius:20px;margin-top:10px;letter-spacing:1px}
      .bid{text-align:center;padding:14px;background:#f9f3e3}
      .bid .id{font-size:1.4rem;font-weight:900;color:#d4890a;letter-spacing:3px}
      .status{display:inline-block;background:#e8f5e9;color:#388e3c;border:1px solid #81c784;font-size:0.7rem;padding:2px 12px;border-radius:12px;margin-top:4px;font-weight:700;text-transform:uppercase}
      hr{border:none;border-top:1px dashed #ddd;margin:0 20px}
      .details{padding:14px 20px}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:0.82rem}
      .lbl{color:#888;min-width:90px}
      .val{font-weight:600;text-align:right;max-width:240px;word-break:break-word}
      .qrs{text-align:center;padding:14px;background:#f9f9f9}
      .qrs p{font-size:0.7rem;color:#999;margin-top:6px}
      .note{margin:0 20px 14px;background:#fffde7;border:1px solid #ffe082;border-radius:6px;padding:10px;text-align:center;font-size:0.75rem;color:#666;line-height:1.5}
      .footer{text-align:center;padding:10px;background:#1a1a1a;color:#aaa;font-size:0.68rem}
    </style></head><body>
    <div class="wrap">
      ${card.innerHTML.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')}
      <div class="footer">© 2025 The Focus Crew · focuscrewph@gmail.com · 09813924006</div>
    </div>
    <script>window.onload=function(){window.print();window.close();}<\/script>
    </body></html>
  `);
  printWin.document.close();
}

// Look up a booking by ID from the DB.
// Accepts: raw QR text (multiline), plain Booking ID string, or any URL-encoded variant.
async function lookupAndShowReceipt(input) {
  if (!input) return;

  // Decode URI encoding if present (some QR encoders URI-encode the text)
  let raw = input;
  try { raw = decodeURIComponent(input); } catch (e) { /* not encoded, keep original */ }

  // Extract booking ID from whatever format we received
  const bookingId = extractBookingId(raw);

  if (!bookingId) {
    // Could not find any booking ID pattern — show error
    renderQRReceipt(null);
    return;
  }

  // Try to get fresh data from DB
  const bookings = await DB.getBookings();
  const found = bookings.find(b => b.id.toLowerCase() === bookingId.toLowerCase());

  if (found) {
    renderQRReceipt(found);
  } else {
    // Not in DB — if QR had full data, use parsed data as fallback
    const parsed = parseBookingQR(raw);
    renderQRReceipt(parsed.id ? parsed : null);
  }
}

function initQRScanner() {
  const startBtn  = document.getElementById('qr-scan-start');
  const stopBtn   = document.getElementById('qr-scan-stop');
  const resultEl  = document.getElementById('qr-scan-result');
  const lookupBtn = document.getElementById('qr-lookup-btn');
  const manualIn  = document.getElementById('qr-booking-input');
  if (!startBtn) return;

  // Manual lookup
  lookupBtn?.addEventListener('click', async () => {
    const val = manualIn?.value.trim();
    if (!val) { Toast.warning('Please enter a Booking ID.'); return; }
    Toast.info('Looking up booking...');
    await lookupAndShowReceipt(val);
  });

  manualIn?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = manualIn.value.trim();
      if (!val) return;
      Toast.info('Looking up booking...');
      await lookupAndShowReceipt(val);
    }
  });

  // --- Native camera scanner (works on all devices: mobile, laptop, desktop) ---
  let videoEl = null;
  let canvasEl = null;
  let scanLoop = null;
  let activeStream = null;

  function buildVideoUI() {
    const container = document.getElementById('qr-video');
    if (!container) return;
    container.innerHTML = '';

    videoEl = document.createElement('video');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('muted', '');
    videoEl.style.cssText = 'width:100%;border-radius:8px;display:block;background:#000;';

    canvasEl = document.createElement('canvas');
    canvasEl.style.display = 'none';

    container.appendChild(videoEl);
    container.appendChild(canvasEl);
  }

  async function startNativeScanner() {
    buildVideoUI();

    // Try rear camera first (mobile), fallback to any available camera (laptop/desktop)
    const constraints = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'user' } },
      { video: true }
    ];

    let stream = null;
    let lastErr = null;
    for (const c of constraints) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
      catch (e) { lastErr = e; }
    }

    if (!stream) {
      const msg = lastErr?.name === 'NotAllowedError'
        ? 'Camera permission denied — allow camera access in your browser then try again.'
        : lastErr?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Camera unavailable — ' + (lastErr?.message || 'unknown error');
      throw new Error(msg);
    }

    activeStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();

    canvasEl.width  = videoEl.videoWidth  || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    const ctx = canvasEl.getContext('2d');

    // jsQR — lightweight, works everywhere, no server needed
    const jsQR = await loadJsQR();

    function tick() {
      if (!activeStream) return;
      if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA) {
        canvasEl.width  = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          stopNativeScanner();
          if (resultEl) resultEl.innerHTML = `<span style="color:#4caf50;font-weight:600;">✅ QR detected! Loading receipt…</span>`;
          Toast.success('QR Code scanned!');
          lookupAndShowReceipt(code.data);
          return;
        }
      }
      scanLoop = requestAnimationFrame(tick);
    }
    scanLoop = requestAnimationFrame(tick);
  }

  function stopNativeScanner() {
    if (scanLoop) { cancelAnimationFrame(scanLoop); scanLoop = null; }
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    if (videoEl) { videoEl.srcObject = null; }
    if (startBtn) startBtn.disabled = false;
    if (stopBtn)  stopBtn.disabled  = true;
  }

  // Lazy-load jsQR from CDN (tiny 30KB library, no install needed)
  function loadJsQR() {
    return new Promise((resolve, reject) => {
      if (window.jsQR) { resolve(window.jsQR); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload  = () => resolve(window.jsQR);
      s.onerror = () => reject(new Error('Failed to load QR library. Check internet connection.'));
      document.head.appendChild(s);
    });
  }

  startBtn.addEventListener('click', async () => {
    if (resultEl) resultEl.innerHTML = `<span style="color:#F5A623;">📷 Starting camera…</span>`;
    startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    try {
      await startNativeScanner();
      if (resultEl) resultEl.innerHTML = `<span style="color:#F5A623;">📷 Scanning… point camera at the QR code.</span>`;
    } catch (err) {
      console.error('QR scanner error:', err);
      Toast.error(err.message);
      if (resultEl) resultEl.innerHTML = `<span style="color:#dc2626;">❌ ${err.message}</span>`;
      startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
    }
  });

  stopBtn?.addEventListener('click', stopNativeScanner);
}

/* ==========================================================
   SECTION 7 — MESSAGES PANEL
   ========================================================== */

async function renderMessages() {
  const tbody = document.getElementById('messages-tbody');
  if (!tbody) return;

  const messages = await DB.getMessages();

  if (messages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:32px;color:#aaa;">
          No messages yet.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = messages.map(m => `
    <tr style="${m.read ? '' : 'background:#fffdf0;'}">
      <td><strong>${escHtml(m.name)}</strong></td>
      <td>${escHtml(m.email)}</td>
      <td>${escHtml(m.service)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${escHtml(m.message)}
      </td>
      <td>${formatDate(m.createdAt, true)}</td>
      <td>
        <button class="btn btn-sm"
                style="background:#dc2626;color:#fff;font-weight:700;border:none;cursor:pointer;border-radius:6px;padding:5px 10px;"
                onclick="deleteMessage('${m.id}')" title="Delete Message">🗑 Delete</button>
      </td>
    </tr>
  `).join('');

  // Mark all as read in the DB
  await DB.markMessagesRead();
  const badge = document.getElementById('stat-messages');
  if (badge) badge.textContent = '0';
}

/* ==========================================================
   SECTION 8 — USERS PANEL
   ========================================================== */

async function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  const users = await DB.getUsers();

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:32px;color:#aaa;">No users yet.</td>
      </tr>`;
    return;
  }

  const session = DB.getSession();

  tbody.innerHTML = users.map(u => {
    const isVerified = u.emailVerified === true || u.emailVerified === 1 || u.email_verified == 1;
    const verifiedBadge = isVerified
      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.3px;">✅ Verified</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#dc2626;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.3px;">✗ Not Verified</span>`;
    return `
    <tr>
      <td><strong>${escHtml(u.name)}</strong></td>
      <td>${escHtml(u.email)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-dark' : ''}">${u.role}</span></td>
      <td>${verifiedBadge}</td>
      <td>${formatDate(u.createdAt, true)}</td>
      <td>
        ${u.id === session?.id
          ? `<span style="color:#aaa;font-size:0.8rem;">Current user</span>`
          : `<button class="btn btn-sm"
                    style="background:#dc2626;color:#fff;font-weight:700;border:none;cursor:pointer;border-radius:6px;padding:5px 10px;"
                    onclick="deleteUser('${u.id}', '${escHtml(u.role)}')" title="Delete User">🗑 Delete</button>`
        }
      </td>
    </tr>`;
  }).join('');
}

/* ==========================================================
   SECTION 9 — UTILITY HELPERS
   ========================================================== */

// Prevent XSS
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Format date string nicely
// Handles both ISO strings with timezone (e.g. "2025-04-15T10:03:00+08:00")
// and plain MySQL datetime strings (e.g. "2025-04-15 10:03:00") which we
// treat as Philippine Standard Time (UTC+8) to avoid off-by-8-hour shifts.
function formatDate(dateStr, showTime = false) {
  if (!dateStr) return '—';

  // If it's a plain MySQL datetime (no T, no Z, no +), force interpret as PHT
  // by replacing the space with T and appending +08:00
  let normalized = dateStr;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(dateStr)) {
    normalized = dateStr.replace(' ', 'T') + '+08:00';
  }
  // If it's a date-only string (YYYY-MM-DD), parse without timezone conversion
  // to avoid the midnight-UTC-rolls-back-one-day issue
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', opts);
  }

  const d = new Date(normalized);
  if (isNaN(d)) return dateStr;
  const opts = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' };
  if (showTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; opts.hour12 = true; }
  return showTime
    ? d.toLocaleString('en-PH', opts)
    : d.toLocaleDateString('en-PH', opts);
}

// Human-readable file size
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)           return bytes + ' B';
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ==========================================================
   SECTION 10 — ADMIN INIT
   ========================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  // Redirect to login if not an admin
  if (!Auth.requireAdmin()) return;

  Toast.init();

  // Show logged-in admin name in header
  const session = DB.getSession();
  const nameEl  = document.getElementById('admin-user-name');
  if (nameEl && session) nameEl.textContent = session.name;

  // Logout button
  document.getElementById('admin-logout')
    ?.addEventListener('click', () => Auth.logout());

  // Init UI components
  initAdminNav();
  initBookingFilters();
  initQRScanner();

  // Load all data
  await renderDashboard();
  await renderAllBookings();
  await renderMessages();
  await renderUsers();

  // Reload correct panel data when switching tabs
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', async () => {
      const panel = link.dataset.panel;
      if (panel === 'dashboard') await renderDashboard();
      if (panel === 'bookings')  await renderAllBookings();
      if (panel === 'messages')  await renderMessages();
      if (panel === 'users')     await renderUsers();
    });
  });
});
