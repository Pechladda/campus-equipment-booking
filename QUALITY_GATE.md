# Quality Gate Review & Improvement Log
**Course:** Midterm Practical Lab Test  
**Project:** Campus Equipment Booking API  
**Student:** Pechladda Duangkaew (Student ID: 6731503112)

---

## 1. Pre-30-Minute Snapshot

During the first 30 minutes of development, the preliminary prototype focused on basic CRUD endpoints for equipment and reservation requests using TypeScript and Hono. 

### Initial State at 00:25:
- Basic `equipment` and `bookings` tables were created.
- Route endpoints `GET`, `POST`, `PATCH`, `DELETE` were drafted.
- An initial time collision check was implemented using simple equality comparison.

### Review Checklist & Quality Gate Inspection:
- [x] Code security review (SQL parameterization check)
- [x] Logic correctness review (Overlapping intervals)
- [x] Edge cases & Boundary tests (Consecutive bookings, cancellations)
- [x] Error handling & HTTP status consistency (400, 404, 409)

---

## 2. Key Findings, Fixes, and Verification Steps

### Finding 1: Flawed Overlap Detection and Rescheduling Self-Conflict
- **Issue Discovered:**  
  The initial overlap logic used a naive query `start_time BETWEEN ? AND ?`. This failed to detect cases where a new booking completely enveloped an existing booking ($S_{new} < S_{old}$ and $E_{new} > E_{old}$) and also incorrectly flagged consecutive adjacent bookings (e.g., a booking ending at 12:00 and another starting at 12:00) as conflicts. Furthermore, when updating a booking via `PATCH`, it conflicted with itself!
- **Code Fix Implemented:**  
  1. Applied the canonical interval overlap theorem:  
     $$\text{Overlap} \iff S_{\text{new}} < E_{\text{existing}} \land E_{\text{new}} > S_{\text{existing}}$$
  2. Filtered out non-active bookings (`status = 'CONFIRMED'`).
  3. In `PATCH /api/bookings/:id`, added `AND id != ?` so rescheduling an existing booking does not cause a false self-conflict.
- **Verification:**  
  Added tests in `test/api.spec.ts`:
  - Enveloping overlap test: returned `409 Conflict` (PASS)
  - Adjacent boundary test (`12:00-14:00` followed by `14:00-16:00`): returned `201 Created` (PASS)
  - Rescheduling self-update test: returned `200 OK` (PASS)

---

### Finding 2: Cascading Orphan Bookings on Equipment Deletion
- **Issue Discovered:**  
  If an administrator or user deleted equipment via `DELETE /api/equipment/:id` while students still had active reservations, those bookings became orphaned or pointed to non-existent equipment.
- **Code Fix Implemented:**  
  Added a business safeguard check before executing delete:
  ```typescript
  const activeBooking = await c.env.DB.prepare(
    `SELECT id FROM bookings WHERE equipment_id = ? AND status = 'CONFIRMED' LIMIT 1`
  ).bind(id).first()

  if (activeBooking) {
    return c.json({ error: 'Cannot delete equipment with active confirmed bookings' }, 400)
  }
  ```
- **Verification:**  
  Added test case in `test/api.spec.ts` verifying that attempting to delete an equipment with active bookings returns `400 Bad Request`, protecting data consistency.

---

### Finding 3: Lenient Input Validation on Timestamps and Email
- **Issue Discovered:**  
  Submitting invalid date strings (e.g. `"tomorrow"`) resulted in `NaN` in JavaScript, which either broke database indexing or bypassed time comparisons. In addition, missing email format validation allowed garbage values into the database.
- **Code Fix Implemented:**  
  1. Added regex validation for `user_email`: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
  2. Used `Date.parse()` to guarantee ISO validity before converting with `.toISOString()`.
  3. Strictly enforced `endMs <= startMs` check returning `400 Bad Request` with message: `"end_time must be strictly after start_time"`.
- **Verification:**  
  Verified with tests in `test/evidence.spec.ts` (Test 3 and Test 6) returning explicit `400 Bad Request` with descriptive JSON messages.

---

## 3. Summary of Improvements

| Area | Before Quality Gate Review | After Quality Gate Review |
|---|---|---|
| **Collision Logic** | Naive `BETWEEN` check (missed envelopments, false self-conflicts) | Standard Interval Overlap ($S_{new} < E_{old} \land E_{new} > S_{old}$) + `id != ?` self-exclusion |
| **Boundary Times** | Adjacent time slots erroneously blocked | Adjacent times allowed (exact minute handoff) |
| **Data Integrity** | Equipment deletion orphaned active reservations | Rejection with `400 Bad Request` if confirmed bookings exist |
| **Input Parsing** | Allowed unparsed strings | Strict ISO-8601 validation and email pattern check |
| **Test Coverage** | 4 simple happy-path tests | 15 comprehensive unit/integration tests + 10 end-to-end HTTP evidence tests |
