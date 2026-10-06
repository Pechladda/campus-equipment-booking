import { Hono } from 'hono'

// ─── Type Definitions ────────────────────────────────────────────────────────

export type Bindings = {
  DB: D1Database
}

export type EquipmentCategory = 'CAMERA' | 'PROJECTOR' | 'MEETING_ROOM' | 'LAPTOP' | 'OTHER'
export type EquipmentStatus = 'AVAILABLE' | 'MAINTENANCE'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  description: string | null
  location: string
  status: EquipmentStatus
  created_at: string
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Booking {
  id: string
  equipment_id: string
  user_name: string
  user_email: string
  start_time: string
  end_time: string
  status: BookingStatus
  purpose: string | null
  created_at: string
  equipment_name?: string
  equipment_category?: EquipmentCategory
  equipment_location?: string
}

// ─── Application Setup ────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Bindings }>()

// Helper to initialize tables and initial seed data if not present
export async function initDb(db?: D1Database) {
  if (!db) return
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS equipment (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        category    TEXT NOT NULL CHECK (category IN ('CAMERA', 'PROJECTOR', 'MEETING_ROOM', 'LAPTOP', 'OTHER')),
        description TEXT,
        location    TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'MAINTENANCE')),
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).run()

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS bookings (
        id           TEXT PRIMARY KEY,
        equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        user_name    TEXT NOT NULL,
        user_email   TEXT NOT NULL,
        start_time   TEXT NOT NULL,
        end_time     TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED')),
        purpose      TEXT,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).run()

    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings (equipment_id, start_time, end_time);`).run()

    // Check if equipment table is empty; if so, populate seed data
    const countRes = await db.prepare('SELECT count(*) as count FROM equipment').first<{ count: number }>()
    if (countRes && countRes.count === 0) {
      await db.batch([
        db.prepare(`INSERT INTO equipment (id, name, category, description, location, status) VALUES 
          ('eq-cam-01', 'Sony Alpha A7 IV (4K)', 'CAMERA', 'Full-frame mirrorless camera with 28-70mm lens and 2 batteries', 'Media Lab Room 402', 'AVAILABLE'),
          ('eq-proj-01', 'Epson EB-PU1007W 4K Laser', 'PROJECTOR', '7000-lumen laser projector with HDMI & wireless presentation', 'Smart Classroom 301', 'AVAILABLE'),
          ('eq-room-01', 'Active Learning Meeting Room A', 'MEETING_ROOM', 'Room with 12 seats, 75-inch smart touch display, videoconference bar', 'Innovation Center 2nd Fl', 'AVAILABLE'),
          ('eq-lap-01', 'MacBook Pro 16" M3 Max', 'LAPTOP', 'High-performance laptop for video editing and AI model training', 'Tech Hub 105', 'AVAILABLE')`),
        db.prepare(`INSERT INTO bookings (id, equipment_id, user_name, user_email, start_time, end_time, status, purpose) VALUES
          ('bk-seed-01', 'eq-cam-01', 'Pechladda Duangkaew', 'pechladda.d@campus.ac.th', '2026-10-10T09:00:00.000Z', '2026-10-10T12:00:00.000Z', 'CONFIRMED', 'Filming student orientation video')`)
      ])
    }
  } catch (err) {
    console.error('Database initialization error:', err)
  }
}

// Middleware: Auto-initialize DB on each request
app.use('*', async (c, next) => {
  if (c.env?.DB) {
    await initDb(c.env.DB)
  }
  await next()
})

// ─── GET / (Dashboard & API Contract Reference) ───────────────────────────────

app.get('/', async (c) => {
  const accept = c.req.header('Accept') || ''
  const isJson = accept.includes('application/json') || c.req.query('format') === 'json'

  if (isJson) {
    return c.json({
      name: 'Campus Equipment Booking API',
      version: '1.0.0',
      description: 'API for reserving university equipment and preventing overlapping bookings',
      status: 'online',
      endpoints: {
        'GET /': 'Interactive Web Dashboard or API Specification (with Accept: application/json)',
        'GET /api/equipment': 'List equipment (supports ?category=&status=&q=)',
        'POST /api/equipment': 'Create equipment (name, category, description, location, status)',
        'GET /api/equipment/:id': 'Get equipment by ID',
        'PATCH /api/equipment/:id': 'Update equipment details or status',
        'DELETE /api/equipment/:id': 'Delete equipment (prevented if active bookings exist)',
        'GET /api/bookings': 'List bookings (supports ?equipment_id=&status=&from=&to=&q=)',
        'POST /api/bookings': 'Create booking with overlap check (returns 409 if conflict)',
        'GET /api/bookings/:id': 'Get booking by ID with equipment details',
        'PATCH /api/bookings/:id': 'Update/reschedule booking (checks overlap on reschedule)',
        'DELETE /api/bookings/:id': 'Cancel or delete a booking'
      },
      status_codes: {
        '200 OK': 'Successful read/update/delete operation',
        '201 Created': 'Resource successfully created',
        '400 Bad Request': 'Validation failure (missing fields, end_time <= start_time, invalid status)',
        '404 Not Found': 'Equipment or Booking ID does not exist',
        '409 Conflict': 'Equipment is already booked for the requested time range (overlap detected)',
        '500 Internal Server Error': 'Database or server execution error'
      }
    })
  }

  // Modern, Glassmorphic Web Dashboard
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campus Equipment Booking System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(20, 27, 45, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --accent: #06b6d4;
      --accent-glow: rgba(6, 182, 212, 0.25);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(79, 70, 229, 0.12) 0%, transparent 45%),
        radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 45%);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1.5rem;
    }
    .container { max-width: 1280px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand { display: flex; align-items: center; gap: 1rem; }
    .brand-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.7rem; box-shadow: 0 0 20px var(--accent-glow);
    }
    .brand h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; }
    .brand p { font-size: 0.85rem; color: var(--text-muted); }
    .actions { display: flex; gap: 0.75rem; }
    .btn {
      padding: 0.75rem 1.4rem; border-radius: 10px; font-weight: 600;
      font-size: 0.9rem; cursor: pointer; border: none; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, #4f46e5, #3730a3);
      color: #fff; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    }
    .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06); color: #fff;
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }
    
    /* Stats Bar */
    .stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem; margin-bottom: 2.5rem;
    }
    .stat-card {
      background: var(--card-bg); backdrop-filter: blur(12px);
      border: 1px solid var(--card-border); border-radius: 16px;
      padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;
    }
    .stat-icon {
      width: 46px; height: 46px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem;
    }
    .stat-val { font-size: 1.6rem; font-weight: 800; }
    .stat-label { font-size: 0.8rem; color: var(--text-muted); }

    /* Tabs */
    .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--card-border); padding-bottom: 0.5rem; }
    .tab-btn {
      background: none; border: none; color: var(--text-muted);
      font-size: 1rem; font-weight: 600; padding: 0.5rem 1rem;
      cursor: pointer; position: relative; font-family: inherit;
    }
    .tab-btn.active { color: #fff; }
    .tab-btn.active::after {
      content: ''; position: absolute; bottom: -0.55rem; left: 0; right: 0;
      height: 3px; background: var(--accent); border-radius: 3px;
    }

    /* Grid cards */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
    .card {
      background: var(--card-bg); backdrop-filter: blur(12px);
      border: 1px solid var(--card-border); border-radius: 16px;
      padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .card:hover { transform: translateY(-3px); border-color: rgba(6, 182, 212, 0.4); }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; }
    .badge {
      display: inline-flex; align-items: center; padding: 0.25rem 0.65rem;
      border-radius: 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-AVAILABLE, .badge-CONFIRMED { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-MAINTENANCE, .badge-CANCELLED { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-COMPLETED { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3); }
    .card-title { font-size: 1.15rem; font-weight: 700; }
    .card-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; flex-grow: 1; }
    .card-meta { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid var(--card-border); padding-top: 0.75rem; }
    .card-footer { display: flex; gap: 0.5rem; }
    .card-footer .btn { flex: 1; padding: 0.45rem; font-size: 0.8rem; justify-content: center; }

    /* API Docs Panel */
    .docs-panel {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 16px; padding: 1.75rem; margin-top: 3rem;
    }
    .docs-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .endpoint {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
      padding: 0.85rem 1.1rem; background: rgba(0,0,0,0.3); border-radius: 10px;
      margin-bottom: 0.6rem; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;
    }
    .m-get { color: #38bdf8; font-weight: 700; margin-right: 0.75rem; }
    .m-post { color: #4ade80; font-weight: 700; margin-right: 0.75rem; }
    .m-patch { color: #facc15; font-weight: 700; margin-right: 0.75rem; }
    .m-del { color: #f87171; font-weight: 700; margin-right: 0.75rem; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
      display: none; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: #131929; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; width: 100%; max-width: 520px; padding: 2rem;
      box-shadow: 0 25px 50px rgba(0,0,0,0.7);
    }
    .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1.1rem; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem; color: #cbd5e1; }
    .form-ctrl {
      width: 100%; padding: 0.7rem 0.9rem; border-radius: 9px;
      background: rgba(255,255,255,0.05); border: 1px solid var(--card-border);
      color: #fff; font-size: 0.9rem; font-family: inherit; outline: none;
    }
    .form-ctrl:focus { border-color: var(--accent); }
    .toast {
      position: fixed; bottom: 2rem; right: 2rem; padding: 0.9rem 1.4rem;
      border-radius: 12px; background: #1e293b; color: #fff; font-size: 0.9rem;
      border: 1px solid var(--primary); box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      z-index: 2000; display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">🏛️</div>
        <div>
          <h1>Campus Equipment Booking API</h1>
          <p>University Resource Reservation &amp; Conflict Prevention System</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" onclick="openEquipmentModal()">➕ Add Equipment</button>
        <button class="btn btn-primary" onclick="openBookingModal()">📅 Book Equipment</button>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(79,70,229,0.15); color: #818cf8;">📦</div>
        <div>
          <div class="stat-val" id="statEquipmentCount">0</div>
          <div class="stat-label">Total Resources</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(16,185,129,0.15); color: #34d399;">✅</div>
        <div>
          <div class="stat-val" id="statAvailableCount">0</div>
          <div class="stat-label">Available Resources</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(6,182,212,0.15); color: #38bdf8;">🕒</div>
        <div>
          <div class="stat-val" id="statActiveBookings">0</div>
          <div class="stat-label">Active Bookings</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(245,158,11,0.15); color: #fbbf24;">🛡️</div>
        <div>
          <div class="stat-val" id="statConflictStatus">Active</div>
          <div class="stat-label">Overlap Prevention Guard</div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
      <button class="tab-btn active" id="tabEquipment" onclick="switchTab('EQUIPMENT')">📦 Equipment Inventory</button>
      <button class="tab-btn" id="tabBookings" onclick="switchTab('BOOKINGS')">📅 Bookings Schedule</button>
    </div>

    <!-- Views Container -->
    <div id="equipmentView" class="grid"></div>
    <div id="bookingsView" class="grid" style="display: none;"></div>

    <!-- API Reference Guide -->
    <div class="docs-panel">
      <div class="docs-title">⚡ Interactive REST API Reference (400, 404, 409 Enforced)</div>
      <div class="endpoint">
        <div><span class="m-get">GET</span> /api/equipment</div>
        <span style="color:var(--text-muted)">List all equipment (?category=&amp;status=&amp;q=)</span>
      </div>
      <div class="endpoint">
        <div><span class="m-post">POST</span> /api/equipment</div>
        <span style="color:var(--text-muted)">Create equipment (validates category, returns 201/400)</span>
      </div>
      <div class="endpoint">
        <div><span class="m-get">GET</span> /api/bookings</div>
        <span style="color:var(--text-muted)">List bookings with joined equipment info</span>
      </div>
      <div class="endpoint">
        <div><span class="m-post">POST</span> /api/bookings</div>
        <span style="color:var(--text-muted)">Create booking (Detects overlaps &amp; returns 409 Conflict)</span>
      </div>
      <div class="endpoint">
        <div><span class="m-patch">PATCH</span> /api/bookings/:id</div>
        <span style="color:var(--text-muted)">Reschedule/Update booking (validates overlap on new time)</span>
      </div>
      <div class="endpoint">
        <div><span class="m-del">DELETE</span> /api/bookings/:id</div>
        <span style="color:var(--text-muted)">Cancel or delete booking record (returns 200/404)</span>
      </div>
    </div>
  </div>

  <!-- Booking Modal -->
  <div class="modal-overlay" id="bookingModal">
    <div class="modal">
      <div class="modal-head">
        <h3 id="bookingModalTitle">Reserve Equipment</h3>
        <button class="btn btn-secondary" onclick="closeModals()" style="padding:0.2rem 0.5rem;">✕</button>
      </div>
      <form id="bookingForm" onsubmit="submitBooking(event)">
        <div class="form-group">
          <label>Equipment *</label>
          <select class="form-ctrl" id="bkEquipmentSelect" required></select>
        </div>
        <div class="form-group">
          <label>Student / Faculty Name *</label>
          <input type="text" class="form-ctrl" id="bkUserName" placeholder="e.g. Pechladda Duangkaew" required>
        </div>
        <div class="form-group">
          <label>Email Address *</label>
          <input type="email" class="form-ctrl" id="bkUserEmail" placeholder="e.g. student@campus.ac.th" required>
        </div>
        <div class="form-group">
          <label>Start Time (ISO/Local) *</label>
          <input type="datetime-local" class="form-ctrl" id="bkStartTime" required>
        </div>
        <div class="form-group">
          <label>End Time (ISO/Local) *</label>
          <input type="datetime-local" class="form-ctrl" id="bkEndTime" required>
        </div>
        <div class="form-group">
          <label>Purpose of Booking</label>
          <textarea class="form-ctrl" id="bkPurpose" rows="2" placeholder="e.g. Capstone project video recording"></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="closeModals()">Cancel</button>
          <button type="submit" class="btn btn-primary">Confirm Reservation</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Equipment Modal -->
  <div class="modal-overlay" id="equipmentModal">
    <div class="modal">
      <div class="modal-head">
        <h3>Add Equipment</h3>
        <button class="btn btn-secondary" onclick="closeModals()" style="padding:0.2rem 0.5rem;">✕</button>
      </div>
      <form id="equipmentForm" onsubmit="submitEquipment(event)">
        <div class="form-group">
          <label>Equipment Name *</label>
          <input type="text" class="form-ctrl" id="eqName" placeholder="e.g. Sony Alpha A7 IV" required>
        </div>
        <div class="form-group">
          <label>Category *</label>
          <select class="form-ctrl" id="eqCategory" required>
            <option value="CAMERA">CAMERA</option>
            <option value="PROJECTOR">PROJECTOR</option>
            <option value="MEETING_ROOM">MEETING_ROOM</option>
            <option value="LAPTOP">LAPTOP</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div class="form-group">
          <label>Location / Room *</label>
          <input type="text" class="form-ctrl" id="eqLocation" placeholder="e.g. Media Lab 402" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-ctrl" id="eqDescription" rows="2" placeholder="Specifications, included accessories..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="closeModals()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Equipment</button>
        </div>
      </form>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let equipments = [];
    let bookings = [];
    let currentTab = 'EQUIPMENT';

    function showToast(msg, isErr = false) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.borderColor = isErr ? 'var(--danger)' : 'var(--success)';
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 4000);
    }

    async function refreshData() {
      try {
        const [eqRes, bkRes] = await Promise.all([
          fetch('/api/equipment'),
          fetch('/api/bookings')
        ]);
        equipments = await eqRes.json();
        bookings = await bkRes.json();
        updateStats();
        renderTab();
        populateEquipmentSelect();
      } catch (err) {
        showToast('Error loading data: ' + err.message, true);
      }
    }

    function updateStats() {
      document.getElementById('statEquipmentCount').innerText = equipments.length;
      document.getElementById('statAvailableCount').innerText = equipments.filter(e => e.status === 'AVAILABLE').length;
      document.getElementById('statActiveBookings').innerText = bookings.filter(b => b.status === 'CONFIRMED').length;
    }

    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tabEquipment').classList.toggle('active', tab === 'EQUIPMENT');
      document.getElementById('tabBookings').classList.toggle('active', tab === 'BOOKINGS');
      document.getElementById('equipmentView').style.display = tab === 'EQUIPMENT' ? 'grid' : 'none';
      document.getElementById('bookingsView').style.display = tab === 'BOOKINGS' ? 'grid' : 'none';
      renderTab();
    }

    function renderTab() {
      if (currentTab === 'EQUIPMENT') {
        const c = document.getElementById('equipmentView');
        if (equipments.length === 0) {
          c.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:var(--text-muted);">No equipment found. Add one above!</div>';
          return;
        }
        c.innerHTML = equipments.map(eq => \`
          <div class="card">
            <div class="card-head">
              <span class="badge badge-\${eq.status}">\${eq.status}</span>
              <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">\${eq.id}</span>
            </div>
            <div>
              <div class="card-title">\${escapeHtml(eq.name)}</div>
              <div style="font-size:0.78rem; color:var(--accent); font-weight:600; margin-top:2px;">📁 \${eq.category}</div>
            </div>
            <div class="card-desc">\${eq.description ? escapeHtml(eq.description) : '<span style="opacity:0.4;">No description</span>'}</div>
            <div class="card-meta">
              <div>📍 \${escapeHtml(eq.location)}</div>
            </div>
            <div class="card-footer">
              <button class="btn btn-primary" onclick="quickBook('\${eq.id}')">📅 Book</button>
              <button class="btn btn-secondary" onclick="deleteEquipment('\${eq.id}')">🗑️</button>
            </div>
          </div>
        \`).join('');
      } else {
        const c = document.getElementById('bookingsView');
        if (bookings.length === 0) {
          c.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:var(--text-muted);">No bookings scheduled.</div>';
          return;
        }
        c.innerHTML = bookings.map(bk => \`
          <div class="card">
            <div class="card-head">
              <span class="badge badge-\${bk.status}">\${bk.status}</span>
              <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">\${bk.id.substring(0,8)}...</span>
            </div>
            <div>
              <div class="card-title">\${escapeHtml(bk.equipment_name || 'Equipment: ' + bk.equipment_id)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">👤 \${escapeHtml(bk.user_name)} (\${escapeHtml(bk.user_email)})</div>
            </div>
            <div class="card-desc">🎯 \${bk.purpose ? escapeHtml(bk.purpose) : '<span style="opacity:0.4;">General reservation</span>'}</div>
            <div class="card-meta">
              <div>⏰ Start: <strong>\${new Date(bk.start_time).toLocaleString()}</strong></div>
              <div>🏁 End: <strong>\${new Date(bk.end_time).toLocaleString()}</strong></div>
            </div>
            <div class="card-footer">
              \${bk.status === 'CONFIRMED' ? \`<button class="btn btn-secondary" onclick="cancelBooking('\${bk.id}')">Cancel Booking</button>\` : ''}
              <button class="btn btn-secondary" onclick="deleteBooking('\${bk.id}')">🗑️</button>
            </div>
          </div>
        \`).join('');
      }
    }

    function populateEquipmentSelect() {
      const sel = document.getElementById('bkEquipmentSelect');
      sel.innerHTML = equipments.map(e => \`<option value="\${e.id}">\${escapeHtml(e.name)} (\${e.category}) - \${e.status}</option>\`).join('');
    }

    function quickBook(id) {
      document.getElementById('bkEquipmentSelect').value = id;
      openBookingModal();
    }

    function openBookingModal() {
      document.getElementById('bookingModal').classList.add('active');
    }
    function openEquipmentModal() {
      document.getElementById('equipmentModal').classList.add('active');
    }
    function closeModals() {
      document.getElementById('bookingModal').classList.remove('active');
      document.getElementById('equipmentModal').classList.remove('active');
    }

    async function submitBooking(e) {
      e.preventDefault();
      const payload = {
        equipment_id: document.getElementById('bkEquipmentSelect').value,
        user_name: document.getElementById('bkUserName').value.trim(),
        user_email: document.getElementById('bkUserEmail').value.trim(),
        start_time: new Date(document.getElementById('bkStartTime').value).toISOString(),
        end_time: new Date(document.getElementById('bkEndTime').value).toISOString(),
        purpose: document.getElementById('bkPurpose').value.trim()
      };

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Booking request failed');
        }
        showToast('Reservation confirmed successfully! (201 Created)');
        closeModals();
        refreshData();
      } catch (err) {
        showToast('Booking Error: ' + err.message, true);
      }
    }

    async function submitEquipment(e) {
      e.preventDefault();
      const payload = {
        name: document.getElementById('eqName').value.trim(),
        category: document.getElementById('eqCategory').value,
        location: document.getElementById('eqLocation').value.trim(),
        description: document.getElementById('eqDescription').value.trim() || null
      };

      try {
        const res = await fetch('/api/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save equipment');
        showToast('Equipment added successfully! (201 Created)');
        closeModals();
        refreshData();
      } catch (err) {
        showToast('Error: ' + err.message, true);
      }
    }

    async function cancelBooking(id) {
      if (!confirm('Cancel this confirmed booking?')) return;
      try {
        const res = await fetch(\`/api/bookings/\${id}\`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELLED' })
        });
        if (!res.ok) throw new Error('Cancellation failed');
        showToast('Booking cancelled.');
        refreshData();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function deleteBooking(id) {
      if (!confirm('Permanently delete this booking record?')) return;
      try {
        const res = await fetch(\`/api/bookings/\${id}\`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        showToast('Booking deleted.');
        refreshData();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function deleteEquipment(id) {
      if (!confirm('Are you sure you want to remove this equipment?')) return;
      try {
        const res = await fetch(\`/api/equipment/\${id}\`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        showToast('Equipment deleted.');
        refreshData();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.innerText = str;
      return div.innerHTML;
    }

    refreshData();
  </script>
</body>
</html>`)
})

// ─── EQUIPMENT API ────────────────────────────────────────────────────────────

// GET /api/equipment - List all equipment with optional filter
app.get('/api/equipment', async (c) => {
  const category = c.req.query('category')
  const status = c.req.query('status')
  const q = c.req.query('q')

  try {
    let query = 'SELECT * FROM equipment'
    const conditions: string[] = []
    const bindings: unknown[] = []

    if (category) {
      conditions.push('category = ?')
      bindings.push(category.toUpperCase())
    }

    if (status) {
      conditions.push('status = ?')
      bindings.push(status.toUpperCase())
    }

    if (q) {
      conditions.push('(name LIKE ? OR location LIKE ? OR description LIKE ?)')
      const pattern = `%${q}%`
      bindings.push(pattern, pattern, pattern)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
    query += ' ORDER BY created_at DESC'

    const stmt = c.env.DB.prepare(query)
    const { results } = bindings.length > 0 ? await stmt.bind(...bindings).all<Equipment>() : await stmt.all<Equipment>()
    return c.json(results || [], 200)
  } catch (err) {
    console.error('Error fetching equipment:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/equipment - Register new equipment
app.post('/api/equipment', async (c) => {
  const body = await c.req.json<Partial<Equipment>>().catch(() => ({} as Partial<Equipment>))
  const { name, category, description, location, status } = body

  // Validation
  if (!name || !category || !location) {
    return c.json({ error: 'name, category, and location are required' }, 400)
  }

  const validCategories: EquipmentCategory[] = ['CAMERA', 'PROJECTOR', 'MEETING_ROOM', 'LAPTOP', 'OTHER']
  if (!validCategories.includes(category as EquipmentCategory)) {
    return c.json({ error: `category must be one of: ${validCategories.join(', ')}` }, 400)
  }

  const validStatuses: EquipmentStatus[] = ['AVAILABLE', 'MAINTENANCE']
  const finalStatus = status || 'AVAILABLE'
  if (!validStatuses.includes(finalStatus as EquipmentStatus)) {
    return c.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400)
  }

  const id = crypto.randomUUID()

  try {
    await c.env.DB.prepare(
      `INSERT INTO equipment (id, name, category, description, location, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, name.trim(), category, description?.trim() ?? null, location.trim(), finalStatus)
      .run()

    const created = await c.env.DB.prepare('SELECT * FROM equipment WHERE id = ?').bind(id).first<Equipment>()
    return c.json(created, 201)
  } catch (err) {
    console.error('Error creating equipment:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/equipment/:id - Get equipment details
app.get('/api/equipment/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const item = await c.env.DB.prepare('SELECT * FROM equipment WHERE id = ?').bind(id).first<Equipment>()
    if (!item) {
      return c.json({ error: 'Equipment not found' }, 404)
    }
    return c.json(item, 200)
  } catch (err) {
    console.error('Error fetching equipment by id:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PATCH /api/equipment/:id - Update equipment
app.patch('/api/equipment/:id', async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json<Partial<Equipment>>().catch(() => ({} as Partial<Equipment>))

  const allowedFields = ['name', 'category', 'description', 'location', 'status'] as const
  const updates: string[] = []
  const values: unknown[] = []

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'category') {
        const validCategories = ['CAMERA', 'PROJECTOR', 'MEETING_ROOM', 'LAPTOP', 'OTHER']
        if (!validCategories.includes(body.category as string)) {
          return c.json({ error: `category must be one of: ${validCategories.join(', ')}` }, 400)
        }
      }
      if (field === 'status') {
        const validStatuses = ['AVAILABLE', 'MAINTENANCE']
        if (!validStatuses.includes(body.status as string)) {
          return c.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400)
        }
      }
      updates.push(`${field} = ?`)
      values.push(body[field])
    }
  }

  if (updates.length === 0) {
    return c.json({ error: 'No valid fields provided for update' }, 400)
  }

  try {
    const existing = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?').bind(id).first()
    if (!existing) {
      return c.json({ error: 'Equipment not found' }, 404)
    }

    values.push(id)
    await c.env.DB.prepare(`UPDATE equipment SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    const updated = await c.env.DB.prepare('SELECT * FROM equipment WHERE id = ?').bind(id).first<Equipment>()
    return c.json(updated, 200)
  } catch (err) {
    console.error('Error updating equipment:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/equipment/:id - Delete equipment
app.delete('/api/equipment/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const existing = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?').bind(id).first()
    if (!existing) {
      return c.json({ error: 'Equipment not found' }, 404)
    }

    // Business Rule Check: Cannot delete equipment if it has active confirmed bookings
    const activeBooking = await c.env.DB.prepare(
      `SELECT id FROM bookings WHERE equipment_id = ? AND status = 'CONFIRMED' LIMIT 1`
    ).bind(id).first()

    if (activeBooking) {
      return c.json({ error: 'Cannot delete equipment with active confirmed bookings' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM equipment WHERE id = ?').bind(id).run()
    return c.json({ message: 'Equipment deleted successfully' }, 200)
  } catch (err) {
    console.error('Error deleting equipment:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ─── BOOKINGS API ─────────────────────────────────────────────────────────────

// GET /api/bookings - List bookings (supports filtering)
app.get('/api/bookings', async (c) => {
  const equipmentId = c.req.query('equipment_id')
  const status = c.req.query('status')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const q = c.req.query('q')

  try {
    let query = `
      SELECT b.*, e.name as equipment_name, e.category as equipment_category, e.location as equipment_location
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
    `
    const conditions: string[] = []
    const bindings: unknown[] = []

    if (equipmentId) {
      conditions.push('b.equipment_id = ?')
      bindings.push(equipmentId)
    }
    if (status) {
      conditions.push('b.status = ?')
      bindings.push(status.toUpperCase())
    }
    if (from) {
      conditions.push('b.end_time >= ?')
      bindings.push(from)
    }
    if (to) {
      conditions.push('b.start_time <= ?')
      bindings.push(to)
    }
    if (q) {
      conditions.push('(b.user_name LIKE ? OR b.purpose LIKE ?)')
      const pattern = `%${q}%`
      bindings.push(pattern, pattern)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
    query += ' ORDER BY b.start_time ASC'

    const stmt = c.env.DB.prepare(query)
    const { results } = bindings.length > 0 ? await stmt.bind(...bindings).all<Booking>() : await stmt.all<Booking>()
    return c.json(results || [], 200)
  } catch (err) {
    console.error('Error fetching bookings:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/bookings - Create new booking with conflict check
app.post('/api/bookings', async (c) => {
  const body = await c.req.json<Partial<Booking>>().catch(() => ({} as Partial<Booking>))
  const { equipment_id, user_name, user_email, start_time, end_time, purpose } = body

  // 1. Validate required fields
  if (!equipment_id || !user_name || !user_email || !start_time || !end_time) {
    return c.json({ error: 'equipment_id, user_name, user_email, start_time, and end_time are required' }, 400)
  }

  // 2. Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(user_email.trim())) {
    return c.json({ error: 'Invalid user_email format' }, 400)
  }

  // 3. Validate Date formats and chronological order
  const startMs = Date.parse(start_time)
  const endMs = Date.parse(end_time)
  if (isNaN(startMs) || isNaN(endMs)) {
    return c.json({ error: 'start_time and end_time must be valid ISO 8601 date strings' }, 400)
  }

  if (endMs <= startMs) {
    return c.json({ error: 'end_time must be strictly after start_time' }, 400)
  }

  const startIso = new Date(startMs).toISOString()
  const endIso = new Date(endMs).toISOString()

  try {
    // 4. Verify equipment exists and is AVAILABLE
    const equip = await c.env.DB.prepare('SELECT * FROM equipment WHERE id = ?').bind(equipment_id).first<Equipment>()
    if (!equip) {
      return c.json({ error: 'Equipment not found' }, 404)
    }

    if (equip.status === 'MAINTENANCE') {
      return c.json({ error: 'Equipment is currently under maintenance and cannot be reserved' }, 400)
    }

    // 5. Overlapping Booking Detection (409 Conflict)
    // Formula: existing_start < new_end AND existing_end > new_start
    const conflicting = await c.env.DB.prepare(`
      SELECT id, user_name, start_time, end_time
      FROM bookings
      WHERE equipment_id = ?
        AND status = 'CONFIRMED'
        AND start_time < ?
        AND end_time > ?
      LIMIT 1
    `).bind(equipment_id, endIso, startIso).first<{ id: string; user_name: string; start_time: string; end_time: string }>()

    if (conflicting) {
      return c.json({
        error: 'Equipment is already booked for the requested time range',
        conflict: {
          conflicting_booking_id: conflicting.id,
          booked_by: conflicting.user_name,
          existing_start: conflicting.start_time,
          existing_end: conflicting.end_time
        }
      }, 409)
    }

    // 6. Insert new booking
    const id = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO bookings (id, equipment_id, user_name, user_email, start_time, end_time, status, purpose)
      VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
    `).bind(id, equipment_id, user_name.trim(), user_email.trim(), startIso, endIso, purpose?.trim() ?? null).run()

    const created = await c.env.DB.prepare(`
      SELECT b.*, e.name as equipment_name, e.category as equipment_category, e.location as equipment_location
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE b.id = ?
    `).bind(id).first<Booking>()

    return c.json(created, 201)
  } catch (err) {
    console.error('Error creating booking:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/bookings/:id - Get booking details
app.get('/api/bookings/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const booking = await c.env.DB.prepare(`
      SELECT b.*, e.name as equipment_name, e.category as equipment_category, e.location as equipment_location
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE b.id = ?
    `).bind(id).first<Booking>()

    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    return c.json(booking, 200)
  } catch (err) {
    console.error('Error fetching booking by id:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PATCH /api/bookings/:id - Update or reschedule booking
app.patch('/api/bookings/:id', async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json<Partial<Booking>>().catch(() => ({} as Partial<Booking>))

  try {
    const existing = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<Booking>()
    if (!existing) {
      return c.json({ error: 'Booking not found' }, 404)
    }

    const updates: string[] = []
    const values: unknown[] = []

    let targetStart = existing.start_time
    let targetEnd = existing.end_time
    let targetStatus = existing.status
    let hasTimeChange = false

    if (body.start_time !== undefined) {
      const sMs = Date.parse(body.start_time)
      if (isNaN(sMs)) return c.json({ error: 'Invalid start_time format' }, 400)
      targetStart = new Date(sMs).toISOString()
      hasTimeChange = true
      updates.push('start_time = ?')
      values.push(targetStart)
    }

    if (body.end_time !== undefined) {
      const eMs = Date.parse(body.end_time)
      if (isNaN(eMs)) return c.json({ error: 'Invalid end_time format' }, 400)
      targetEnd = new Date(eMs).toISOString()
      hasTimeChange = true
      updates.push('end_time = ?')
      values.push(targetEnd)
    }

    if (hasTimeChange) {
      if (new Date(targetEnd).getTime() <= new Date(targetStart).getTime()) {
        return c.json({ error: 'end_time must be strictly after start_time' }, 400)
      }
    }

    if (body.status !== undefined) {
      const validStatuses: BookingStatus[] = ['CONFIRMED', 'CANCELLED', 'COMPLETED']
      if (!validStatuses.includes(body.status)) {
        return c.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400)
      }
      targetStatus = body.status
      updates.push('status = ?')
      values.push(targetStatus)
    }

    if (body.user_name !== undefined) {
      updates.push('user_name = ?')
      values.push(body.user_name.trim())
    }

    if (body.user_email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.user_email.trim())) {
        return c.json({ error: 'Invalid user_email format' }, 400)
      }
      updates.push('user_email = ?')
      values.push(body.user_email.trim())
    }

    if (body.purpose !== undefined) {
      updates.push('purpose = ?')
      values.push(body.purpose ? body.purpose.trim() : null)
    }

    if (updates.length === 0) {
      return c.json({ error: 'No valid fields provided for update' }, 400)
    }

    // If active and rescheduling time (or reactivating status), check for overlaps (excluding self)
    if (targetStatus === 'CONFIRMED' && (hasTimeChange || (existing.status !== 'CONFIRMED' && body.status === 'CONFIRMED'))) {
      const conflicting = await c.env.DB.prepare(`
        SELECT id, user_name, start_time, end_time
        FROM bookings
        WHERE equipment_id = ?
          AND id != ?
          AND status = 'CONFIRMED'
          AND start_time < ?
          AND end_time > ?
        LIMIT 1
      `).bind(existing.equipment_id, id, targetEnd, targetStart).first<{ id: string; user_name: string; start_time: string; end_time: string }>()

      if (conflicting) {
        return c.json({
          error: 'Rescheduling conflict: Equipment is already booked for the requested time range',
          conflict: {
            conflicting_booking_id: conflicting.id,
            booked_by: conflicting.user_name,
            existing_start: conflicting.start_time,
            existing_end: conflicting.end_time
          }
        }, 409)
      }
    }

    values.push(id)
    await c.env.DB.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    const updated = await c.env.DB.prepare(`
      SELECT b.*, e.name as equipment_name, e.category as equipment_category, e.location as equipment_location
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE b.id = ?
    `).bind(id).first<Booking>()

    return c.json(updated, 200)
  } catch (err) {
    console.error('Error updating booking:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/bookings/:id - Delete booking
app.delete('/api/bookings/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const existing = await c.env.DB.prepare('SELECT id FROM bookings WHERE id = ?').bind(id).first()
    if (!existing) {
      return c.json({ error: 'Booking not found' }, 404)
    }

    await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run()
    return c.json({ message: 'Booking deleted successfully' }, 200)
  } catch (err) {
    console.error('Error deleting booking:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


// ─── EXAM ROUTES: /bookings (camelCase fields as per exam spec) ───────────────
//
// The exam requires:
//   - Routes at /bookings (not /api/bookings)
//   - Fields: equipmentId, borrowerName, startAt, endAt, purpose
//   - DELETE returns 204 (no body)
//
// These routes reuse the same DB tables and overlap logic as above.
// The only difference is field name mapping (camelCase ↔ snake_case).

// GET /bookings - List all bookings
app.get('/bookings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT b.id,
             b.equipment_id  AS equipmentId,
             b.user_name     AS borrowerName,
             b.start_time    AS startAt,
             b.end_time      AS endAt,
             b.purpose,
             b.status,
             b.created_at    AS createdAt,
             e.name          AS equipmentName
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      ORDER BY b.start_time ASC
    `).all<{
      id: string
      equipmentId: string
      borrowerName: string
      startAt: string
      endAt: string
      purpose: string | null
      status: string
      createdAt: string
      equipmentName: string | null
    }>()
    return c.json(results || [], 200)
  } catch (err) {
    console.error('GET /bookings error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /bookings/:id - Get single booking
app.get('/bookings/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const booking = await c.env.DB.prepare(`
      SELECT b.id,
             b.equipment_id  AS equipmentId,
             b.user_name     AS borrowerName,
             b.start_time    AS startAt,
             b.end_time      AS endAt,
             b.purpose,
             b.status,
             b.created_at    AS createdAt,
             e.name          AS equipmentName
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE b.id = ?
    `).bind(id).first()

    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    return c.json(booking, 200)
  } catch (err) {
    console.error('GET /bookings/:id error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /bookings - Create new booking
// Expected body: { equipmentId, borrowerName, startAt, endAt, purpose }
app.post('/bookings', async (c) => {
  // Parse body; if JSON is malformed, default to empty object
  const body = await c.req.json<{
    equipmentId?: string
    borrowerName?: string
    startAt?: string
    endAt?: string
    purpose?: string
  }>().catch(() => ({}))

  const { equipmentId, borrowerName, startAt, endAt, purpose } = body

  // STEP 6 — Validation: Check missing required fields → 400
  if (!equipmentId || !borrowerName || !startAt || !endAt) {
    return c.json(
      { error: 'equipmentId, borrowerName, startAt, and endAt are required' },
      400
    )
  }

  // Validate that startAt and endAt are parseable ISO dates
  const startMs = Date.parse(startAt)
  const endMs   = Date.parse(endAt)
  if (isNaN(startMs) || isNaN(endMs)) {
    return c.json(
      { error: 'startAt and endAt must be valid ISO 8601 date strings' },
      400
    )
  }

  // Validate chronological order: startAt must be before endAt → 400
  if (endMs <= startMs) {
    return c.json({ error: 'startAt must be before endAt' }, 400)
  }

  // Normalise to full ISO 8601 string for consistent DB storage
  const startIso = new Date(startMs).toISOString()
  const endIso   = new Date(endMs).toISOString()

  try {
    // STEP 6 — Validation: Check equipmentId exists → 404
    // Uses parameter binding (?) — no string concatenation
    const equip = await c.env.DB
      .prepare('SELECT id FROM equipment WHERE id = ?')
      .bind(equipmentId)        // ← parameter binding (STEP 7 security)
      .first()

    if (!equip) {
      return c.json({ error: 'Equipment not found' }, 404)
    }

    // STEP 5 — Overlap prevention (409 Conflict)
    // The formula catches every overlap case:
    //   existing.startAt < new.endAt  AND  existing.endAt > new.startAt
    // Only CONFIRMED bookings count (cancelled/completed don't block).
    const conflict = await c.env.DB.prepare(`
      SELECT id FROM bookings
      WHERE equipment_id = ?
        AND status = 'CONFIRMED'
        AND start_time < ?
        AND end_time   > ?
      LIMIT 1
    `).bind(equipmentId, endIso, startIso).first<{ id: string }>()

    if (conflict) {
      return c.json(
        { error: 'Booking time conflicts with an existing booking' },
        409
      )
    }

    // Insert — every value is a ? placeholder, never concatenated
    const newId = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO bookings (id, equipment_id, user_name, start_time, end_time, purpose, user_email)
      VALUES (?, ?, ?, ?, ?, ?, '')
    `).bind(newId, equipmentId, borrowerName.trim(), startIso, endIso, purpose?.trim() ?? null).run()

    // Return the created booking with camelCase fields
    const created = await c.env.DB.prepare(`
      SELECT b.id,
             b.equipment_id  AS equipmentId,
             b.user_name     AS borrowerName,
             b.start_time    AS startAt,
             b.end_time      AS endAt,
             b.purpose,
             b.status,
             b.created_at    AS createdAt,
             e.name          AS equipmentName
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE b.id = ?
    `).bind(newId).first()

    return c.json(created, 201)
  } catch (err) {
    console.error('POST /bookings error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PATCH /bookings/:id - Update a booking (any subset of fields)
// Body may include: equipmentId, borrowerName, startAt, endAt, purpose
app.patch('/bookings/:id', async (c) => {
  const { id } = c.req.param()

  const body = await c.req.json<{
    equipmentId?: string
    borrowerName?: string
    startAt?: string
    endAt?: string
    purpose?: string
  }>().catch(() => ({}))

  try {
    // Fetch the existing booking first → 404 if not found
    const existing = await c.env.DB.prepare(
      'SELECT * FROM bookings WHERE id = ?'
    ).bind(id).first<{
      id: string
      equipment_id: string
      user_name: string
      start_time: string
      end_time: string
      status: string
      purpose: string | null
    }>()

    if (!existing) {
      return c.json({ error: 'Booking not found' }, 404)
    }

    // Build the SET clause dynamically — only update provided fields
    const setClauses: string[] = []
    const bindValues: unknown[] = []

    // Resolve the times we will actually use (updated or existing)
    let targetStart = existing.start_time
    let targetEnd   = existing.end_time
    let timeChanged = false

    if (body.startAt !== undefined) {
      const ms = Date.parse(body.startAt)
      if (isNaN(ms)) return c.json({ error: 'Invalid startAt format' }, 400)
      targetStart = new Date(ms).toISOString()
      timeChanged = true
      setClauses.push('start_time = ?')
      bindValues.push(targetStart)
    }

    if (body.endAt !== undefined) {
      const ms = Date.parse(body.endAt)
      if (isNaN(ms)) return c.json({ error: 'Invalid endAt format' }, 400)
      targetEnd = new Date(ms).toISOString()
      timeChanged = true
      setClauses.push('end_time = ?')
      bindValues.push(targetEnd)
    }

    // If either time changed, re-validate chronological order
    if (timeChanged && new Date(targetEnd).getTime() <= new Date(targetStart).getTime()) {
      return c.json({ error: 'startAt must be before endAt' }, 400)
    }

    if (body.borrowerName !== undefined) {
      setClauses.push('user_name = ?')
      bindValues.push(body.borrowerName.trim())
    }

    if (body.purpose !== undefined) {
      setClauses.push('purpose = ?')
      bindValues.push(body.purpose ? body.purpose.trim() : null)
    }

    // equipmentId change: validate new equipment exists
    let targetEquipmentId = existing.equipment_id
    if (body.equipmentId !== undefined) {
      const equip = await c.env.DB
        .prepare('SELECT id FROM equipment WHERE id = ?')
        .bind(body.equipmentId)
        .first()
      if (!equip) return c.json({ error: 'Equipment not found' }, 404)
      targetEquipmentId = body.equipmentId
      setClauses.push('equipment_id = ?')
      bindValues.push(targetEquipmentId)
    }

    if (setClauses.length === 0) {
      return c.json({ error: 'No valid fields provided for update' }, 400)
    }

    // STEP 5 — Overlap check for PATCH:
    //   Exclude the booking being patched (AND id != ?) so it does NOT
    //   conflict with itself. This is the key PATCH edge case.
    if (timeChanged || body.equipmentId !== undefined) {
      const conflict = await c.env.DB.prepare(`
        SELECT id FROM bookings
        WHERE equipment_id = ?
          AND id != ?
          AND status = 'CONFIRMED'
          AND start_time < ?
          AND end_time   > ?
        LIMIT 1
      `).bind(targetEquipmentId, id, targetEnd, targetStart).first<{ id: string }>()

      if (conflict) {
        return c.json(
          { error: 'Booking time conflicts with an existing booking' },
          409
        )
      }
    }

    // Execute update — id is always the last bind value for WHERE clause
    bindValues.push(id)
    await c.env.DB.prepare(
      `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...bindValues).run()

    // Return updated booking with camelCase fields
    const updated = await c.env.DB.prepare(`
      SELECT b.id,
             b.equipment_id  AS equipmentId,
             b.user_name     AS borrowerName,
             b.start_time    AS startAt,
             b.end_time      AS endAt,
             b.purpose,
             b.status,
             b.created_at    AS createdAt,
             e.name          AS equipmentName
      FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE b.id = ?
    `).bind(id).first()

    return c.json(updated, 200)
  } catch (err) {
    console.error('PATCH /bookings/:id error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /bookings/:id - Delete a booking
// Returns 204 No Content on success (no response body)
app.delete('/bookings/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const existing = await c.env.DB
      .prepare('SELECT id FROM bookings WHERE id = ?')
      .bind(id)
      .first()

    if (!existing) {
      return c.json({ error: 'Booking not found' }, 404)
    }

    await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run()

    // 204 No Content — the spec requires this for successful DELETE
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /bookings/:id error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
