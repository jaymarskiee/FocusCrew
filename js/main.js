  // ============================================================
  //  THE FOCUS CREW — main.js  (MySQL / PHP API version)
  //  All data operations call /api/*.php — no localStorage DB
  // ============================================================

  /* ==========================================================
    SECTION 1 — API HELPER
    Central fetch wrapper used by all DB methods below
    ========================================================== */

  const API = {

    // Base path to the api/ folder
    base: 'api/',

    // GET request with query params
    async get(file, params = {}) {
      const url = new URL(
        this.base + file,
        window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/') 
      );
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      try {
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        console.error('API GET error:', e);
        return { success: false, error: 'Network error. Please try again.' };
      }
    },

    // POST request with JSON body
    async post(file, action, body = {}) {
      const url = this.base + file + '?action=' + action;
      try {
        const res = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        // Always try to parse JSON even on error status codes
        // so we can show the actual error message from PHP
        const data = await res.json().catch(() => ({
          success: false,
          error: 'Server error (HTTP ' + res.status + '). Please try again.',
        }));
        return data;
      } catch (e) {
        console.error('API POST error:', e);
        return { success: false, error: 'Network error. Please check your connection.' };
      }
    },


  };

  /* ==========================================================
    SECTION 2 — DATABASE LAYER  (calls PHP API)
    ========================================================== */

  const DB = {

    // ── Users ──────────────────────────────────────────────
    async getUsers()             { const r = await API.get('users.php', { action: 'list' }); return r.users || []; },
    async findUser(email, pass)  { return API.post('users.php', 'login',    { email, password: pass }); },
    async addUser(u)             { return API.post('users.php', 'register', u); },
    async deleteUser(id)         { return API.post('users.php', 'delete',   { id }); },

    // ── Bookings ───────────────────────────────────────────
    async getBookings()            { const r = await API.get('bookings.php', { action: 'list' }); return r.bookings || []; },
    async addBooking(b)            { return API.post('bookings.php', 'add',           b); },
    async updateBookingStatus(id, status) { return API.post('bookings.php', 'update_status', { id, status }); },
    async deleteBooking(id)        { return API.post('bookings.php', 'delete',        { id }); },

    // ── Messages ───────────────────────────────────────────
    async getMessages()        { const r = await API.get('messages.php', { action: 'list' }); return r.messages || []; },
    async addMessage(m)        { return API.post('messages.php', 'add',       m); },
    async markMessagesRead()   { return API.post('messages.php', 'mark_read', {}); },
    async deleteMessage(id)    { return API.post('messages.php', 'delete',    { id }); },

    // ── Session (browser sessionStorage — no server needed) ─
    getSession()     { try { return JSON.parse(localStorage.getItem('fc_session')) || null; } catch { return null; } },
    setSession(user) { localStorage.setItem('fc_session', JSON.stringify(user)); },
    clearSession()   { localStorage.removeItem('fc_session'); },
    isLoggedIn()     { return !!this.getSession(); },
    isAdmin()        { const s = this.getSession(); return !!(s && s.role === 'admin'); },
  };

  /* ==========================================================
    SECTION 3 — AUTHENTICATION
    ========================================================== */

  const Auth = {

    async login(email, password) {
      const result = await DB.findUser(email, password);
      if (result.success) DB.setSession(result.user);
      return result;
    },

    logout() {
      DB.clearSession();
      window.location.href = 'login.html';
    },

    async register(name, email, password) {
      const result = await DB.addUser({ name, email, password });
      // Do NOT set session — user must verify email first
      return result;
    },

    requireLogin() {
      if (!DB.isLoggedIn()) { window.location.href = 'login.html'; return false; }
      return true;
    },

    requireAdmin() {
      if (!DB.isAdmin()) { window.location.href = 'login.html'; return false; }
      return true;
    },
  };

  /* ==========================================================
    SECTION 4 — TOAST NOTIFICATIONS
    ========================================================== */

  const Toast = {
    container: null,

    init() {
      if (document.getElementById('toast-container')) {
        this.container = document.getElementById('toast-container');
        return;
      }
      this.container = document.createElement('div');
      this.container.id        = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3500) {
      if (!this.container) this.init();
      const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
      const toast  = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `<span>${icons[type] || '🔔'}</span> ${message}`;
      this.container.appendChild(toast);
      setTimeout(() => {
        toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:0.3s ease;';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    success(m) { this.show(m, 'success'); },
    error(m)   { this.show(m, 'error');   },
    info(m)    { this.show(m, 'info');    },
    warning(m) { this.show(m, 'warning'); },
  };

  /* ==========================================================
    SECTION 5 — FORM VALIDATION
    ========================================================== */

  const Validator = {

    rules: {
      required: v => v.trim() !== ''                         || 'This field is required.',
      email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)   || 'Enter a valid email address.',
      phone:    v => /^[0-9+\-\s]{7,15}$/.test(v)           || 'Enter a valid phone number.',
      minLen:  n => v => v.length >= n                       || `Minimum ${n} characters required.`,
      maxLen:  n => v => v.length <= n                       || `Maximum ${n} characters allowed.`,
    },

    field(value, ruleList) {
      for (const rule of ruleList) {
        const fn     = typeof rule === 'function' ? rule : this.rules[rule];
        const result = fn(value);
        if (result !== true) return { valid: false, message: result };
      }
      return { valid: true };
    },

    showError(input, message) {
      input.classList.add('error');
      let err = input.parentElement.querySelector('.field-error');
      if (!err) {
        err = document.createElement('small');
        err.className  = 'field-error';
        err.style.cssText = 'color:#e74c3c;font-size:0.8rem;display:block;margin-top:4px;';
        input.parentElement.appendChild(err);
      }
      err.textContent = message;
    },

    clearError(input) {
      input.classList.remove('error');
      input.parentElement.querySelector('.field-error')?.remove();
    },

    validateForm(fields) {
      let valid = true;
      fields.forEach(({ input, rules }) => {
        this.clearError(input);
        const result = this.field(input.value, rules);
        if (!result.valid) { this.showError(input, result.message); valid = false; }
      });
      return valid;
    },
  };

  /* ==========================================================
    SECTION 6 — NAVBAR
    ========================================================== */

  function initNavbar() {
    const hamburger   = document.querySelector('.hamburger');
    const mobileMenu  = document.querySelector('.mobile-menu');
    const mobileClose = document.querySelector('.mobile-close');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => mobileMenu.classList.add('open'));
      mobileClose?.addEventListener('click', () => mobileMenu.classList.remove('open'));
      mobileMenu.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => mobileMenu.classList.remove('open'))
      );
    }

    // Highlight current page link
    const page = window.location.pathname.split('/').pop();
    document.querySelectorAll('.navbar-links a, .mobile-menu a').forEach(a => {
      if (a.getAttribute('href') === page) a.classList.add('active');
    });

    // Show logged-in user info in navbar
    const session    = DB.getSession();
    const navActions = document.querySelector('.navbar-actions');
    if (navActions && session) {
      navActions.innerHTML = `
        <span style="color:#aaa;font-size:0.85rem;">Hi, ${session.name}</span>
        ${session.role === 'admin' ? '<a href="admin.html" class="btn btn-primary btn-sm">Dashboard</a>' : ''}
        <button onclick="Auth.logout()" class="btn btn-dark btn-sm">Logout</button>
      `;
    }
  }

  /* ==========================================================
    SECTION 7 — SCROLL ANIMATIONS
    ========================================================== */

  function initScrollAnimations() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  }

  /* ==========================================================
    SECTION 8 — CONTACT FORM
    ========================================================== */

  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const name    = document.getElementById('c-name');
      const email   = document.getElementById('c-email');
      const phone   = document.getElementById('c-phone');
      const service = document.getElementById('c-service');
      const message = document.getElementById('c-message');

      const valid = Validator.validateForm([
        { input: name,    rules: [Validator.rules.required] },
        { input: email,   rules: [Validator.rules.required, Validator.rules.email] },
        { input: phone,   rules: [Validator.rules.required, Validator.rules.phone] },
        { input: service, rules: [Validator.rules.required] },
        { input: message, rules: [Validator.rules.required, Validator.rules.minLen(10)] },
      ]);
      if (!valid) return;

      const btn = form.querySelector('button[type=submit]');
      btn.disabled  = true;
      btn.innerHTML = '<span class="spinner"></span> Sending...';

      const result = await DB.addMessage({
        name:    name.value,
        email:   email.value,
        phone:   phone.value,
        service: service.value,
        message: message.value,
      });

      btn.disabled    = false;
      btn.textContent = 'Send Message';

      if (result.success) {
        form.reset();
        Toast.success("Message sent! We'll get back to you soon.");
      } else {
        Toast.error(result.error || 'Failed to send. Please try again.');
      }
    });
  }

  /* ==========================================================
    SECTION 9 — BOOKING FORM
    ========================================================== */

  function initBookingForm() {
    const form = document.getElementById('booking-form');
    if (!form) return;

    // ── Guard: require login before booking ──
    // If not logged in, hide the form and show a "login/register" prompt instead
    if (!DB.isLoggedIn()) {
      form.innerHTML = `
        <div style="text-align:center; padding:32px 16px;">
          <div style="font-size:3rem; margin-bottom:16px;">🔒</div>
          <h3 style="font-family:var(--font-display); font-size:1.5rem; letter-spacing:1px; margin-bottom:12px;">
            REGISTER TO <span style="color:var(--yellow);">BOOK</span>
          </h3>
          <p style="color:#aaa; font-size:0.95rem; margin-bottom:24px; line-height:1.6;">
            You need an account to submit a booking request.<br>
            Create a free account in just a few seconds!
          </p>
          <a href="login.html?tab=register" class="btn btn-primary" style="width:100%; justify-content:center; margin-bottom:12px;">
            📝 Create an Account
          </a>
          <a href="login.html" class="btn btn-dark" style="width:100%; justify-content:center;">
            🔑 Already have an account? Login
          </a>
        </div>
      `;
      return;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const name    = document.getElementById('b-name');
      const email   = document.getElementById('b-email');
      const phone   = document.getElementById('b-phone');
      const service = document.getElementById('b-service');
      const date    = document.getElementById('b-date');

      const valid = Validator.validateForm([
        { input: name,    rules: [Validator.rules.required] },
        { input: email,   rules: [Validator.rules.required, Validator.rules.email] },
        { input: phone,   rules: [Validator.rules.required, Validator.rules.phone] },
        { input: service, rules: [Validator.rules.required] },
        { input: date,    rules: [Validator.rules.required] },
      ]);
      if (!valid) return;

      const btn = form.querySelector('button[type=submit]');
      btn.disabled  = true;
      btn.innerHTML = '<span class="spinner"></span> Booking...';

      const result = await DB.addBooking({
        clientName: name.value,
        email:      email.value,
        phone:      phone.value,
        service:    service.value,
        date:       date.value,
        notes:      document.getElementById('b-notes')?.value || '',
      });

      btn.disabled    = false;
      btn.textContent = 'Book Now';

      if (result.success) {
        form.reset();
        showReceiptModal(result.booking);
      } else {
        Toast.error(result.error || 'Booking failed. Please try again.');
      }
    });
  }

  /* ==========================================================
    SECTION 9B — RECEIPT MODAL WITH QR CODE
    ========================================================== */

  function showReceiptModal(booking) {
    // Remove existing modal if any
    document.getElementById('receipt-modal')?.remove();

    const formatDate = (d) => {
      if (!d) return '—';
      // Date-only string (YYYY-MM-DD) — parse as local to avoid UTC midnight shift
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [yr, mo, dy] = d.split('-').map(Number);
        return new Date(yr, mo - 1, dy).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      // Datetime string — normalize to PHT if no timezone info present
      let normalized = d;
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(d)) normalized = d.replace(' ', 'T') + '+08:00';
      const dt = new Date(normalized);
      return isNaN(dt) ? d : dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
    };

    const formatDateTime = (d) => {
      if (!d) return '—';
      let normalized = d;
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(d)) normalized = d.replace(' ', 'T') + '+08:00';
      const dt = new Date(normalized);
      return isNaN(dt) ? d : dt.toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
    };

    // Build QR content — compact booking summary
    const qrContent = [
      'THE FOCUS CREW - BOOKING RECEIPT',
      'Booking ID: ' + booking.id,
      'Name: ' + booking.clientName,
      'Email: ' + booking.email,
      'Phone: ' + booking.phone,
      'Service: ' + booking.service,
      'Date: ' + booking.date,
      'Status: ' + booking.status.toUpperCase(),
      'Booked: ' + (booking.createdAt || new Date().toLocaleString()),
    ].join('\n');

    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=' + encodeURIComponent(qrContent);

    const modal = document.createElement('div');
    modal.id = 'receipt-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; padding:16px; backdrop-filter:blur(4px);
    `;

    modal.innerHTML = `
      <div id="receipt-card" style="
        background:#111; border:1px solid #333; border-radius:16px;
        width:100%; max-width:480px; max-height:90vh; overflow-y:auto;
        font-family:'Segoe UI',sans-serif; color:#eee;
      ">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a); padding:24px; border-radius:16px 16px 0 0; text-align:center; border-bottom:1px solid #F5A623;">
          <div style="font-size:2rem; margin-bottom:4px;">📸</div>
          <div style="color:#F5A623; font-weight:900; font-size:1.1rem; letter-spacing:2px;">THE FOCUS CREW</div>
          <div style="color:#888; font-size:0.75rem; margin-top:2px;">FC's Photography Services · Bohol, Philippines</div>
          <div style="margin-top:14px; display:inline-block; background:#F5A623; color:#111; font-weight:800; font-size:0.8rem; padding:4px 18px; border-radius:20px; letter-spacing:1px;">
            BOOKING RECEIPT
          </div>
        </div>

        <!-- Booking ID -->
        <div style="padding:16px 24px 0; text-align:center;">
          <div style="color:#888; font-size:0.72rem; letter-spacing:1px; text-transform:uppercase;">Booking Reference</div>
          <div style="font-size:1.5rem; font-weight:900; color:#F5A623; letter-spacing:3px; margin-top:2px;">${booking.id}</div>
          <div style="display:inline-block; background:#1e3a1e; color:#4caf50; border:1px solid #4caf50; font-size:0.72rem; padding:3px 14px; border-radius:12px; margin-top:6px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
            ● ${booking.status}
          </div>
        </div>

        <!-- Divider -->
        <div style="margin:16px 24px; border-top:1px dashed #333;"></div>

        <!-- Details -->
        <div style="padding:0 24px;">
          ${[
            ['👤 Client', booking.clientName],
            ['✉️ Email', booking.email],
            ['📞 Phone', booking.phone],
            ['📷 Service', booking.service],
            ['📅 Shoot Date', formatDate(booking.date)],
            ['🕐 Booked On', formatDateTime(booking.createdAt)],
          ].map(([label, val]) => `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:8px 0; border-bottom:1px solid #1e1e1e;">
              <span style="color:#888; font-size:0.8rem; min-width:100px;">${label}</span>
              <span style="font-size:0.85rem; font-weight:600; text-align:right; max-width:240px; word-break:break-word;">${val || '—'}</span>
            </div>
          `).join('')}
        </div>

        <!-- Divider -->
        <div style="margin:16px 24px 0; border-top:1px dashed #333;"></div>

        <!-- QR Code -->
        <div style="padding:16px 24px; text-align:center;">
          <div style="color:#888; font-size:0.72rem; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px;">Scan to Verify Booking</div>
          <div style="display:inline-block; background:#fff; padding:10px; border-radius:10px;">
            <img src="${qrUrl}" alt="Booking QR Code" width="160" height="160" style="display:block;" onerror="this.parentElement.innerHTML='<div style=color:#888;font-size:0.75rem;padding:20px>QR unavailable offline</div>'" />
          </div>
          <div style="color:#555; font-size:0.7rem; margin-top:8px;">This QR contains your booking details</div>
        </div>

        <!-- Note -->
        <div style="margin:0 24px 16px; background:#1a1a0e; border:1px solid #3a3a1a; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:0.78rem; color:#aaa; line-height:1.5;">
            ⏳ We'll confirm your booking within <strong style="color:#F5A623;">24 hours</strong> via email or phone.<br>
            📞 <a href="tel:09813924006" style="color:#F5A623; text-decoration:none;">09813924006</a>
          </div>
        </div>

        <!-- Actions -->
        <div style="padding:0 24px 24px; display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="printReceipt()" style="
            flex:1; background:#F5A623; color:#111; border:none; border-radius:8px;
            padding:12px; font-weight:800; font-size:0.85rem; cursor:pointer; letter-spacing:1px;
          ">🖨️ PRINT RECEIPT</button>
          <button onclick="document.getElementById('receipt-modal').remove()" style="
            flex:1; background:#1e1e1e; color:#eee; border:1px solid #333; border-radius:8px;
            padding:12px; font-weight:700; font-size:0.85rem; cursor:pointer;
          ">✕ Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  function printReceipt() {
    const card = document.getElementById('receipt-card');
    if (!card) return;
    const printWin = window.open('', '_blank', 'width=560,height=800');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Booking Receipt – The Focus Crew</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#fff; font-family:'Segoe UI',Arial,sans-serif; color:#111; padding:20px; }
          .receipt-wrap { max-width:440px; margin:auto; border:2px solid #F5A623; border-radius:12px; overflow:hidden; }
          .receipt-header { background:#1a1a1a; color:#F5A623; text-align:center; padding:20px; }
          .receipt-header h1 { font-size:1rem; letter-spacing:2px; margin-bottom:2px; }
          .receipt-header p { font-size:0.72rem; color:#aaa; }
          .receipt-badge { display:inline-block; background:#F5A623; color:#111; font-weight:800; font-size:0.75rem; padding:3px 14px; border-radius:20px; margin-top:10px; letter-spacing:1px; }
          .booking-id { text-align:center; padding:14px; background:#f9f3e3; }
          .booking-id span { font-size:1.4rem; font-weight:900; color:#d4890a; letter-spacing:3px; }
          .status-badge { display:inline-block; background:#e8f5e9; color:#388e3c; border:1px solid #81c784; font-size:0.7rem; padding:2px 12px; border-radius:12px; margin-top:4px; font-weight:700; text-transform:uppercase; }
          .divider { border:none; border-top:1px dashed #ddd; margin:0 20px; }
          .details { padding:14px 20px; }
          .detail-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:0.82rem; }
          .detail-label { color:#888; min-width:90px; }
          .detail-value { font-weight:600; text-align:right; max-width:240px; word-break:break-word; }
          .qr-section { text-align:center; padding:14px; background:#f9f9f9; }
          .qr-section p { font-size:0.7rem; color:#999; margin-top:6px; }
          .note { margin:0 20px 14px; background:#fffde7; border:1px solid #ffe082; border-radius:6px; padding:10px; text-align:center; font-size:0.75rem; color:#666; line-height:1.5; }
          .footer { text-align:center; padding:10px; background:#1a1a1a; color:#aaa; font-size:0.68rem; }
        </style>
      </head>
      <body>
        <div class="receipt-wrap">
          <div class="receipt-header">
            <div style="font-size:1.5rem">📸</div>
            <h1>THE FOCUS CREW</h1>
            <p>FC's Photography Services · Bohol, Philippines</p>
            <span class="receipt-badge">BOOKING RECEIPT</span>
          </div>
          ${card.querySelector('.booking-id, [style*="Booking Reference"]') ? '' : ''}
          ${card.innerHTML
            .replace(/<button[^>]*>.*?<\/button>/gs, '')
            .replace(/style="[^"]*position:fixed[^"]*"/g, '')
          }
          <div class="footer">© 2025 The Focus Crew · focuscrewph@gmail.com · 09813924006</div>
        </div>
        <script>window.onload=function(){window.print();window.close();}<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  /* ==========================================================
    SECTION 10 — GALLERY (filter + lightbox)
    ========================================================== */

  function initGallery() {
    const galleryEl    = document.getElementById('gallery-grid');
    if (!galleryEl) return;

    const filterBtns   = document.querySelectorAll('.filter-btn');
    const lightbox     = document.getElementById('lightbox');
    const lightboxImg  = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');

    // Category filter
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.filter;
        galleryEl.querySelectorAll('.gallery-item').forEach(item => {
          item.style.display = (cat === 'all' || item.dataset.cat === cat) ? '' : 'none';
        });
      });
    });

    // Lightbox open
    galleryEl.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        const img = item.querySelector('img');
        if (img && lightbox && lightboxImg) {
          lightboxImg.src = img.src;
          lightbox.classList.add('open');
        }
      });
    });

    // Lightbox close
    lightboxClose?.addEventListener('click', () => lightbox.classList.remove('open'));
    lightbox?.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('open'); });
  }

  /* ==========================================================
    SECTION 11 — INIT ON DOM READY
    ========================================================== */

  document.addEventListener('DOMContentLoaded', () => {
    Toast.init();
    initNavbar();
    initScrollAnimations();
    initContactForm();
    initBookingForm();
    initGallery();
  });
