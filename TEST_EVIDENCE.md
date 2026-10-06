# Test Evidence & Verification Report
**Course:** Midterm Practical Lab Test  
**Project:** Campus Equipment Booking API  
**Student:** Pechladda Duangkaew (Student ID: 6731503112)  
**Stack:** TypeScript, Hono, SQLite / Cloudflare D1  
**Test Suite:** Vitest v4.1.11 (15 unit/integration tests + 10 end-to-end HTTP evidence tests)

---

## Summary of Test Results

| Case # | Description | HTTP Method & Path | Expected Status | Result Status | Pass / Fail |
|---|---|---|---|---|---|
| **Case 1** | API Contract & Specification Metadata | `GET /` (`Accept: application/json`) | `200 OK` | `200 OK` | **PASS** |
| **Case 2** | Create University Equipment | `POST /api/equipment` | `201 Created` | `201 Created` | **PASS** |
| **Case 3** | Validation Failure: Missing Required Fields | `POST /api/equipment` | `400 Bad Request` | `400 Bad Request` | **PASS** |
| **Case 4** | Create Valid Reservation / Booking | `POST /api/bookings` | `201 Created` | `201 Created` | **PASS** |
| **Case 5** | **Overlapping Booking Detection (Conflict Guard)** | `POST /api/bookings` | `409 Conflict` | `409 Conflict` | **PASS** |
| **Case 6** | Validation Failure: `end_time <= start_time` | `POST /api/bookings` | `400 Bad Request` | `400 Bad Request` | **PASS** |
| **Case 7** | Resource Not Found Check | `GET /api/bookings/:id` | `404 Not Found` | `404 Not Found` | **PASS** |
| **Case 8** | Reschedule Booking to Open Slot | `PATCH /api/bookings/:id` | `200 OK` | `200 OK` | **PASS** |
| **Case 9** | Delete Booking | `DELETE /api/bookings/:id` | `200 OK` | `200 OK` | **PASS** |
| **Case 10** | Verify Deletion | `GET /api/bookings/:id` | `404 Not Found` | `404 Not Found` | **PASS** |
| **Case 11** | Safeguard: Prevent Deleting Equipment with Active Booking | `DELETE /api/equipment/:id` | `400 Bad Request` | `400 Bad Request` | **PASS** |

---

## Detailed Execution Logs & curl Evidence

### Test 1: API Contract & Specification Metadata
**Command:**
```bash
curl -i -X GET http://localhost:8787/ -H "Accept: application/json"
```
**Response (`200 OK`):**
```json
{
  "name": "Campus Equipment Booking API",
  "version": "1.0.0",
  "description": "API for reserving university equipment and preventing overlapping bookings",
  "status": "online",
  "endpoints": {
    "GET /": "Interactive Web Dashboard or API Specification (with Accept: application/json)",
    "GET /api/equipment": "List equipment (supports ?category=&status=&q=)",
    "POST /api/equipment": "Create equipment (name, category, description, location, status)",
    "GET /api/equipment/:id": "Get equipment by ID",
    "PATCH /api/equipment/:id": "Update equipment details or status",
    "DELETE /api/equipment/:id": "Delete equipment (prevented if active bookings exist)",
    "GET /api/bookings": "List bookings (supports ?equipment_id=&status=&from=&to=&q=)",
    "POST /api/bookings": "Create booking with overlap check (returns 409 if conflict)",
    "GET /api/bookings/:id": "Get booking by ID with equipment details",
    "PATCH /api/bookings/:id": "Update/reschedule booking (checks overlap on reschedule)",
    "DELETE /api/bookings/:id": "Cancel or delete a booking"
  },
  "status_codes": {
    "200 OK": "Successful read/update/delete operation",
    "201 Created": "Resource successfully created",
    "400 Bad Request": "Validation failure (missing fields, end_time <= start_time, invalid status)",
    "404 Not Found": "Equipment or Booking ID does not exist",
    "409 Conflict": "Equipment is already booked for the requested time range (overlap detected)",
    "500 Internal Server Error": "Database or server execution error"
  }
}
```

---

### Test 2: Create Equipment (`201 Created`)
**Command:**
```bash
curl -i -X POST http://localhost:8787/api/equipment \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sony FX3 Cinema Camera",
    "category": "CAMERA",
    "location": "Studio B",
    "description": "Full-frame cinema line"
  }'
```
**Response (`201 Created`):**
```json
{
  "id": "bcbe629f-a58f-4686-b114-4b5442e770e4",
  "name": "Sony FX3 Cinema Camera",
  "category": "CAMERA",
  "description": "Full-frame cinema line",
  "location": "Studio B",
  "status": "AVAILABLE",
  "created_at": "2026-10-06 06:39:38"
}
```

---

### Test 3: Validation Error - Missing Fields (`400 Bad Request`)
**Command:**
```bash
curl -i -X POST http://localhost:8787/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"name": "Invalid Item", "category": "DRONE"}'
```
**Response (`400 Bad Request`):**
```json
{
  "error": "name, category, and location are required"
}
```

---

### Test 4: Create Valid Booking (`201 Created`)
**Command:**
```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "bcbe629f-a58f-4686-b114-4b5442e770e4",
    "user_name": "Pechladda D.",
    "user_email": "pechladda@campus.ac.th",
    "start_time": "2026-10-15T13:00:00.000Z",
    "end_time": "2026-10-15T16:00:00.000Z",
    "purpose": "Senior film project"
  }'
```
**Response (`201 Created`):**
```json
{
  "id": "49d1d91e-3e7f-481d-8579-72290180d503",
  "equipment_id": "bcbe629f-a58f-4686-b114-4b5442e770e4",
  "user_name": "Pechladda D.",
  "user_email": "pechladda@campus.ac.th",
  "start_time": "2026-10-15T13:00:00.000Z",
  "end_time": "2026-10-15T16:00:00.000Z",
  "status": "CONFIRMED",
  "purpose": "Senior film project",
  "created_at": "2026-10-06 06:39:38",
  "equipment_name": "Sony FX3 Cinema Camera",
  "equipment_category": "CAMERA",
  "equipment_location": "Studio B"
}
```

---

### Test 5: Overlapping Booking Conflict Detection (`409 Conflict`)
**Scenario:** Another student requests the same camera during `14:00 - 17:00` (which overlaps with `13:00 - 16:00`).  
**Command:**
```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "bcbe629f-a58f-4686-b114-4b5442e770e4",
    "user_name": "Alex Rivard",
    "user_email": "alex@campus.ac.th",
    "start_time": "2026-10-15T14:00:00.000Z",
    "end_time": "2026-10-15T17:00:00.000Z",
    "purpose": "Overlapping request"
  }'
```
**Response (`409 Conflict`):**
```json
{
  "error": "Equipment is already booked for the requested time range",
  "conflict": {
    "conflicting_booking_id": "49d1d91e-3e7f-481d-8579-72290180d503",
    "booked_by": "Pechladda D.",
    "existing_start": "2026-10-15T13:00:00.000Z",
    "existing_end": "2026-10-15T16:00:00.000Z"
  }
}
```

---

### Test 6: Chronological Date Validation Error (`400 Bad Request`)
**Scenario:** `end_time` is earlier than `start_time`.  
**Command:**
```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "bcbe629f-a58f-4686-b114-4b5442e770e4",
    "user_name": "Alex",
    "user_email": "alex@campus.ac.th",
    "start_time": "2026-10-15T18:00:00.000Z",
    "end_time": "2026-10-15T17:00:00.000Z"
  }'
```
**Response (`400 Bad Request`):**
```json
{
  "error": "end_time must be strictly after start_time"
}
```

---

### Test 7: Non-Existent Resource (`404 Not Found`)
**Command:**
```bash
curl -i -X GET http://localhost:8787/api/bookings/unknown-booking-id
```
**Response (`404 Not Found`):**
```json
{
  "error": "Booking not found"
}
```

---

### Test 8: Reschedule Booking (`200 OK`)
**Scenario:** Student reschedules reservation to an open evening slot `17:00 - 20:00`.  
**Command:**
```bash
curl -i -X PATCH http://localhost:8787/api/bookings/49d1d91e-3e7f-481d-8579-72290180d503 \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2026-10-15T17:00:00.000Z",
    "end_time": "2026-10-15T20:00:00.000Z",
    "purpose": "Rescheduled night session"
  }'
```
**Response (`200 OK`):**
```json
{
  "id": "49d1d91e-3e7f-481d-8579-72290180d503",
  "equipment_id": "bcbe629f-a58f-4686-b114-4b5442e770e4",
  "user_name": "Pechladda D.",
  "user_email": "pechladda@campus.ac.th",
  "start_time": "2026-10-15T17:00:00.000Z",
  "end_time": "2026-10-15T20:00:00.000Z",
  "status": "CONFIRMED",
  "purpose": "Rescheduled night session",
  "created_at": "2026-10-06 06:39:38",
  "equipment_name": "Sony FX3 Cinema Camera",
  "equipment_category": "CAMERA",
  "equipment_location": "Studio B"
}
```

---

### Test 9: Delete Booking (`200 OK`)
**Command:**
```bash
curl -i -X DELETE http://localhost:8787/api/bookings/49d1d91e-3e7f-481d-8579-72290180d503
```
**Response (`200 OK`):**
```json
{
  "message": "Booking deleted successfully"
}
```

---

### Test 10: Verify Deletion (`404 Not Found`)
**Command:**
```bash
curl -i -X GET http://localhost:8787/api/bookings/49d1d91e-3e7f-481d-8579-72290180d503
```
**Response (`404 Not Found`):**
```json
{
  "error": "Booking not found"
}
```
