# AI Responsibility Log (AI_LOG.md)

**Student:** Pechladda Duangkaew  
**Date:** 2026-10-06  
**Tool used:** Antigravity IDE (Gemini / Claude)

---

## How I Used AI

I used AI as a coding assistant to help inspect the starter repository, identify gaps, and implement the required features. I verified all important logic myself before submitting.

---

## Log of Important Interactions

### Interaction 1 — Repository Inspection

**Prompt I gave:**
> "Inspect the existing repository and identify project structure, entry point, database setup, existing routes, existing schema/migrations, and available dependencies."

**What AI returned:**
- A list of all files in the project
- Summary of existing routes (`/api/equipment`, `/api/bookings`)
- Identified that the database schema already had `equipment` and `bookings` tables with seed data

**What I verified myself:**
- I opened `src/index.ts` and confirmed the routes exist
- I read `schema.sql` and confirmed the table structure matches what AI described
- I confirmed seed data has 4 equipment records and 1 booking

**What I accepted / rejected:**
- ✅ Accepted: The file structure analysis was accurate
- ✅ Accepted: The identified gap (routes were at `/api/bookings` not `/bookings`)

---

### Interaction 2 — Gap Analysis

**Prompt I gave:**
> "The exam requires routes at /bookings with fields equipmentId, borrowerName, startAt, endAt. The existing code uses /api/bookings with snake_case fields. What needs to change?"

**What AI returned:**
- Three gaps: route prefix, field names, DELETE status code (200 → 204)
- Plan to add new `/bookings` routes alongside existing `/api/bookings`

**What I verified myself:**
- I re-read the exam spec and confirmed the required field names: `equipmentId`, `borrowerName`, `startAt`, `endAt`
- I confirmed DELETE must return 204 (no body) from the spec table
- I checked that keeping `/api/bookings` intact preserves the web dashboard

**What I accepted / rejected:**
- ✅ Accepted: Adding new routes instead of replacing existing ones is safer
- ✅ Accepted: 204 No Content with `new Response(null, { status: 204 })`

---

### Interaction 3 — Overlap Logic

**Prompt I gave:**
> "Implement overlap prevention using this formula: existing.startAt < new.endAt AND existing.endAt > new.startAt. For PATCH, the booking should not conflict with itself."

**What AI returned:**
```sql
SELECT id FROM bookings
WHERE equipment_id = ?
  AND status = 'CONFIRMED'
  AND start_time < ?
  AND end_time   > ?
LIMIT 1
```
And for PATCH: added `AND id != ?`

**What I verified myself:**
- I drew out three overlap scenarios on paper:
  - New booking starts inside existing → caught ✅
  - New booking ends inside existing → caught ✅
  - New booking wraps around existing → caught ✅
  - Adjacent bookings (end == new start) → correctly NOT caught ✅
- I checked that PATCH query includes `AND id != ?` to avoid self-conflict

**What I accepted / rejected:**
- ✅ Accepted: The formula is mathematically correct for all cases
- ✅ Accepted: Self-exclusion with `AND id != ?` is the right approach

---

### Interaction 4 — SQL Security Review

**Prompt I gave:**
> "Verify that every SQL query uses parameter binding and that no request input is concatenated into SQL."

**What AI returned:**
- Confirmed all queries use `?` placeholders with `.bind(...)`
- No string interpolation found in SQL

**What I verified myself:**
- I searched the code for template literals inside `.prepare()` calls
- All dynamic values come from `.bind()`, never from `${variable}` inside SQL strings
- I understand WHY: parameter binding prevents SQL injection

---

### Interaction 5 — Test Run

**Prompt I gave:**
> "Run the test suite and show curl commands for all 7 required test cases."

**What AI returned:**
- 16/16 tests passing
- Live curl results showing correct status codes for all cases

**What I verified myself:**
- I ran `npm test` myself and saw 16 tests pass
- I ran each curl command myself in Terminal and saw the responses
- I confirmed 204 has no body, 409 has `{"error":"..."}` format, etc.

---

## Key Decisions I Made Myself

1. **Keep `/api/bookings` intact** — The web dashboard at `/` uses these routes. Deleting them would break the UI.
2. **Use SQL `AS` aliases** — Instead of transforming data in JavaScript, I let SQL return the columns with the right names (`equipment_id AS equipmentId`). This is simpler and easier to explain.
3. **Only CONFIRMED bookings block** — Cancelled bookings should free the slot. I added `AND status = 'CONFIRMED'` to the overlap query.
4. **`new Response(null, { status: 204 })`** — Hono's `c.json()` always adds a body. For 204 I used the raw Response constructor to ensure no body is sent.

---

## What I Can Explain Without AI Help

- How the overlap formula works (drew it on paper)
- Why `AND id != ?` is needed in PATCH
- Why parameter binding prevents SQL injection
- The meaning of 200, 201, 204, 400, 404, 409
- The foreign key relationship between `equipment` and `bookings`
- How Hono routes work (`app.get()`, `app.post()`, etc.)
