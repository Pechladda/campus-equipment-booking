# Campus Equipment Booking API

Backend REST API for reserving shared campus equipment (cameras, projectors, meeting rooms) with overlap prevention.

## Tech Stack

- **Runtime:** Cloudflare Workers (local via Wrangler)
- **Framework:** Hono v4
- **Database:** Cloudflare D1 (SQLite-compatible)
- **Language:** TypeScript

## Prerequisites

- Node.js 18+
- npm

## How to Run

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

The server starts at: **`http://localhost:8787`**

### 3. Open in browser (optional Web Dashboard)

Visit `http://localhost:8787` to see the interactive equipment booking dashboard.

## Base API URL

```
http://localhost:8787
```

Booking endpoints: `http://localhost:8787/bookings`  
Equipment endpoints: `http://localhost:8787/api/equipment`

## Run Tests (automated)

```bash
npm test
```

Expected: **16 tests passed**

## Quick curl Test

```bash
# List all bookings
curl http://localhost:8787/bookings

# Create a booking
curl -X POST http://localhost:8787/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "eq-proj-01",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-20T09:00:00.000Z",
    "endAt": "2026-10-20T11:00:00.000Z",
    "purpose": "Class presentation"
  }'
```

## Project Structure

```
campus-equipment-booking/
├── src/
│   ├── index.ts          # Main app — all routes and business logic
│   └── d1-sqlite.ts      # Test adapter (D1 → Node SQLite)
├── test/
│   ├── api.spec.ts       # 16 automated tests
│   └── evidence.spec.ts  # Evidence output generator
├── schema.sql            # Database schema + seed data
├── wrangler.jsonc        # Cloudflare Workers config
├── README.md
├── API_CONTRACT.md
├── AI_LOG.md
└── QUALITY_GATE_REVIEW.md
```

## Seed Data (pre-loaded)

| ID | Name | Category |
|----|------|----------|
| `eq-cam-01` | Sony Alpha A7 IV (4K) | CAMERA |
| `eq-proj-01` | Epson EB-PU1007W 4K Laser | PROJECTOR |
| `eq-room-01` | Active Learning Meeting Room A | MEETING_ROOM |
| `eq-lap-01` | MacBook Pro 16" M3 Max | LAPTOP |
