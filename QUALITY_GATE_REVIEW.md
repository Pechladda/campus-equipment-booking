# Quality Gate Review (QUALITY_GATE_REVIEW.md)

**Student:** Pechladda Duangkaew  
**Date:** 2026-10-06  

## Pre-30-Minute Snapshot Summary
At the 30-minute mark, the API had functional CRUD operations at `/api/bookings` using the starter repository's original snake_case schema (`equipment_id`, `start_time`). The overlap logic was implemented but hadn't been fully verified against the specific exam requirements.

---

## Findings, Fixes, and Verification

### Finding 1: API Contract Mismatch (Reliability / Accuracy)
* **What I found:** The initial implementation used snake_case fields (e.g., `equipment_id`, `start_time`, `end_time`) and the endpoint was `/api/bookings`. The exam strictly required camelCase (e.g., `equipmentId`, `startAt`, `endAt`) and the endpoint `/bookings`.
* **How I fixed it:** I created new route handlers mapped to `/bookings`. Instead of changing the underlying SQLite database schema (which would break the starter dashboard), I handled the transformation in the SQL queries using aliases (e.g., `SELECT equipment_id AS equipmentId, start_time AS startAt`).
* **Evidence:** Running `curl -s http://localhost:8787/bookings` now returns JSON keys matching the exam exactly: `[{"equipmentId": "eq-cam-01", "startAt": "...", ...}]`.

### Finding 2: Incorrect DELETE Status Code (Reliability / Accuracy)
* **What I found:** The original DELETE endpoint was returning a `200 OK` status with a JSON body `{"message": "Booking deleted successfully"}`. The exam contract specifies that DELETE must return `204 No Content`.
* **How I fixed it:** I updated the return statement in the `DELETE /bookings/:id` handler to use the standard Web API Response object: `return new Response(null, { status: 204 })`. This ensures the correct status code and guarantees an empty body.
* **Evidence:** Running `curl -i -X DELETE http://localhost:8787/bookings/<id>` outputs `HTTP/1.1 204 No Content` with zero content length.

### Finding 3: PATCH Self-Conflict Edge Case (Reasoning / You Own It)
* **What I found:** When mentally walking through the overlap SQL query (`start_time < newEnd AND end_time > newStart`), I realized a critical bug in the `PATCH` endpoint. If a user tries to update only the `purpose` of a booking without changing the times, the query would find the booking's *own* existing time slot and reject the update with a `409 Conflict`.
* **How I fixed it:** I added an exclusion clause to the overlap check specifically for the PATCH route: `AND id != ?` (binding the current booking ID). This ensures a booking doesn't conflict with itself.
* **Evidence:** Sent a PATCH request modifying only the `purpose` string: `curl -i -X PATCH ... -d '{"purpose": "updated"}'`. It successfully returned `200 OK` instead of the `409 Conflict` it would have previously triggered.
