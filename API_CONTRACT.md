# API Contract — Campus Equipment Booking

## Base URL

```
http://localhost:8787
```

---

## Equipment Endpoints

### GET /api/equipment
List all equipment.

**Response 200:**
```json
[
  {
    "id": "eq-cam-01",
    "name": "Sony Alpha A7 IV (4K)",
    "category": "CAMERA",
    "location": "Media Lab Room 402",
    "status": "AVAILABLE",
    "created_at": "..."
  }
]
```

---

## Booking Endpoints

### GET /bookings
List all bookings.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "equipmentId": "eq-proj-01",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-20T09:00:00.000Z",
    "endAt": "2026-10-20T11:00:00.000Z",
    "purpose": "Class presentation",
    "status": "CONFIRMED",
    "equipmentName": "Epson EB-PU1007W 4K Laser",
    "createdAt": "..."
  }
]
```

---

### GET /bookings/:id
Get a single booking by ID.

**Response 200:** Same shape as above (single object).

**Response 404:**
```json
{ "error": "Booking not found" }
```

---

### POST /bookings
Create a new booking.

**Request Body:**
```json
{
  "equipmentId": "eq-proj-01",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `equipmentId` | string | ✅ | Must exist in equipment table |
| `borrowerName` | string | ✅ | Non-empty |
| `startAt` | ISO 8601 string | ✅ | Must be before `endAt` |
| `endAt` | ISO 8601 string | ✅ | Must be after `startAt` |
| `purpose` | string | ❌ | Optional |

**Response 201:** Created booking object (same shape as GET).

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing required field | `{ "error": "equipmentId, borrowerName, startAt, and endAt are required" }` |
| 400 | `endAt <= startAt` | `{ "error": "startAt must be before endAt" }` |
| 400 | Unparseable date string | `{ "error": "startAt and endAt must be valid ISO 8601 date strings" }` |
| 404 | `equipmentId` not found | `{ "error": "Equipment not found" }` |
| 409 | Time conflict with existing booking | `{ "error": "Booking time conflicts with an existing booking" }` |

---

### PATCH /bookings/:id
Update an existing booking. Send only the fields you want to change.

**Request Body (all fields optional):**
```json
{
  "equipmentId": "eq-cam-01",
  "borrowerName": "New Name",
  "startAt": "2026-10-20T10:00:00.000Z",
  "endAt": "2026-10-20T12:00:00.000Z",
  "purpose": "Updated purpose"
}
```

**Response 200:** Updated booking object.

**Error Responses:** Same as POST plus:

| Status | Condition |
|--------|-----------|
| 400 | No valid fields provided |
| 400 | New time range is invalid |
| 404 | Booking not found |
| 409 | New time conflicts with another booking |

> **Note:** PATCH excludes the booking being updated from the overlap check (`AND id != ?`), so a booking never conflicts with its own current time slot.

---

### DELETE /bookings/:id
Delete a booking permanently.

**Response 204:** No body.

**Response 404:**
```json
{ "error": "Booking not found" }
```

---

## Overlap Prevention Logic

A conflict exists when, for the same `equipmentId` with `status = 'CONFIRMED'`:

```
existing.startAt < new.endAt
AND
existing.endAt > new.startAt
```

SQL used:
```sql
SELECT id FROM bookings
WHERE equipment_id = ?
  AND status = 'CONFIRMED'
  AND start_time < ?
  AND end_time   > ?
LIMIT 1
```

Adjacent bookings (e.g., 09:00–11:00 then 11:00–13:00) are **allowed** because the condition uses strict `<` and `>`.

---

## HTTP Status Code Rationale

| Code | Meaning | When used |
|------|---------|-----------|
| 200 | OK | Successful GET or PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Missing fields, invalid dates, bad time order |
| 404 | Not Found | Equipment or booking ID does not exist |
| 409 | Conflict | Booking overlaps with an existing confirmed booking |

---

## Assumptions

1. `borrowerName` replaces the concept of user authentication — no login is required.
2. Only `CONFIRMED` bookings count for overlap detection. `CANCELLED` or `COMPLETED` bookings free the time slot.
3. Equipment availability status (`MAINTENANCE`) is tracked but does not block booking creation in the `/bookings` exam routes (the `/api/bookings` routes do check this).
4. All times are stored and compared as ISO 8601 UTC strings.
5. The `purpose` field is optional.
