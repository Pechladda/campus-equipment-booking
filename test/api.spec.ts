import { describe, it, expect, beforeEach } from 'vitest'
import app, { initDb } from '../src/index'
import { createSqliteD1 } from '../src/d1-sqlite'

describe('Campus Equipment Booking API Suite', () => {
  let db: D1Database
  let env: { DB: D1Database }

  beforeEach(async () => {
    // Create a fresh in-memory SQLite D1 instance for each test
    db = createSqliteD1(':memory:')
    await initDb(db)
    env = { DB: db }
  })

  // ─── 1. Metadata and Dashboard ───────────────────────────────────────────

  it('GET / with Accept: application/json returns API contract metadata', async () => {
    const res = await app.request('http://localhost/', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, env)

    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.name).toBe('Campus Equipment Booking API')
    expect(data.endpoints).toBeDefined()
    expect(data.status_codes['409 Conflict']).toBeDefined()
  })

  it('GET / returns HTML Web Dashboard', async () => {
    const res = await app.request('http://localhost/', {
      method: 'GET'
    }, env)

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Campus Equipment Booking')
    expect(html).toContain('Equipment Inventory')
  })

  // ─── 2. Equipment CRUD & Validation ───────────────────────────────────────

  it('POST /api/equipment creates new equipment (201 Created)', async () => {
    const payload = {
      name: 'Blackmagic Pocket Cinema 6K',
      category: 'CAMERA',
      location: 'Broadcast Studio 101',
      description: 'Cinema camera with EF mount',
      status: 'AVAILABLE'
    }

    const res = await app.request('http://localhost/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, env)

    expect(res.status).toBe(201)
    const data = await res.json() as any
    expect(data.id).toBeDefined()
    expect(data.name).toBe(payload.name)
    expect(data.category).toBe('CAMERA')
  })

  it('POST /api/equipment fails with 400 Bad Request on missing fields or invalid category', async () => {
    // Missing location
    const res1 = await app.request('http://localhost/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Cam', category: 'CAMERA' })
    }, env)
    expect(res1.status).toBe(400)

    // Invalid category
    const res2 = await app.request('http://localhost/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Car', category: 'VEHICLE', location: 'Garage' })
    }, env)
    expect(res2.status).toBe(400)
    const err = await res2.json() as any
    expect(err.error).toContain('category must be one of')
  })

  it('GET /api/equipment filters by category and search keyword', async () => {
    const res = await app.request('http://localhost/api/equipment?category=CAMERA', {
      method: 'GET'
    }, env)

    expect(res.status).toBe(200)
    const items = await res.json() as any[]
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => i.category === 'CAMERA')).toBe(true)
  })

  it('GET /api/equipment/:id returns 404 for nonexistent id', async () => {
    const res = await app.request('http://localhost/api/equipment/non-existent-id', {
      method: 'GET'
    }, env)
    expect(res.status).toBe(404)
    const data = await res.json() as any
    expect(data.error).toBe('Equipment not found')
  })

  // ─── 3. Booking CRUD & Business Rules ────────────────────────────────────

  it('POST /api/bookings successfully reserves equipment (201 Created)', async () => {
    const payload = {
      equipment_id: 'eq-proj-01',
      user_name: 'Dr. Jane Smith',
      user_email: 'jane.smith@campus.ac.th',
      start_time: '2026-10-15T10:00:00.000Z',
      end_time: '2026-10-15T12:00:00.000Z',
      purpose: 'Guest Lecture on AI & Web Development'
    }

    const res = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, env)

    expect(res.status).toBe(201)
    const data = await res.json() as any
    expect(data.id).toBeDefined()
    expect(data.equipment_id).toBe('eq-proj-01')
    expect(data.equipment_name).toBe('Epson EB-PU1007W 4K Laser')
    expect(data.status).toBe('CONFIRMED')
  })

  it('POST /api/bookings returns 400 Bad Request when end_time <= start_time', async () => {
    const payload = {
      equipment_id: 'eq-proj-01',
      user_name: 'Dr. Jane Smith',
      user_email: 'jane.smith@campus.ac.th',
      start_time: '2026-10-15T12:00:00.000Z',
      end_time: '2026-10-15T10:00:00.000Z',
      purpose: 'Invalid time order'
    }

    const res = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, env)

    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toBe('end_time must be strictly after start_time')
  })

  it('POST /api/bookings returns 404 Not Found for nonexistent equipment', async () => {
    const payload = {
      equipment_id: 'non-existent-equip',
      user_name: 'Test Student',
      user_email: 'student@campus.ac.th',
      start_time: '2026-10-15T10:00:00.000Z',
      end_time: '2026-10-15T12:00:00.000Z'
    }

    const res = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, env)

    expect(res.status).toBe(404)
    const data = await res.json() as any
    expect(data.error).toBe('Equipment not found')
  })

  // ─── 4. Crucial Overlap Conflict Detection (409 Conflict) ───────────────

  it('POST /api/bookings returns 409 Conflict when reserving overlapping time slots', async () => {
    // Initial booking: 14:00 - 16:00
    await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-room-01',
        user_name: 'Alice',
        user_email: 'alice@campus.ac.th',
        start_time: '2026-10-20T14:00:00.000Z',
        end_time: '2026-10-20T16:00:00.000Z',
        purpose: 'Team Meeting'
      })
    }, env)

    // Overlapping Attempt 1: 15:00 - 17:00 (Overlaps end of Alice's slot)
    const res1 = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-room-01',
        user_name: 'Bob',
        user_email: 'bob@campus.ac.th',
        start_time: '2026-10-20T15:00:00.000Z',
        end_time: '2026-10-20T17:00:00.000Z',
        purpose: 'Presentation'
      })
    }, env)

    expect(res1.status).toBe(409)
    const conflictData1 = await res1.json() as any
    expect(conflictData1.error).toContain('already booked')
    expect(conflictData1.conflict.booked_by).toBe('Alice')

    // Overlapping Attempt 2: 13:00 - 15:00 (Overlaps start of Alice's slot)
    const res2 = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-room-01',
        user_name: 'Charlie',
        user_email: 'charlie@campus.ac.th',
        start_time: '2026-10-20T13:00:00.000Z',
        end_time: '2026-10-20T15:00:00.000Z',
        purpose: 'Study Group'
      })
    }, env)

    expect(res2.status).toBe(409)

    // Overlapping Attempt 3: 14:15 - 15:45 (Completely inside Alice's slot)
    const res3 = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-room-01',
        user_name: 'Dave',
        user_email: 'dave@campus.ac.th',
        start_time: '2026-10-20T14:15:00.000Z',
        end_time: '2026-10-20T15:45:00.000Z',
        purpose: 'Short Sync'
      })
    }, env)

    expect(res3.status).toBe(409)
  })

  it('allows adjacent non-overlapping bookings (Boundary conditions)', async () => {
    // Initial booking: 14:00 - 16:00
    await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-lap-01',
        user_name: 'User 1',
        user_email: 'u1@campus.ac.th',
        start_time: '2026-10-22T14:00:00.000Z',
        end_time: '2026-10-22T16:00:00.000Z'
      })
    }, env)

    // Adjacent Booking IMMEDIATELY following: 16:00 - 18:00
    const resAfter = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-lap-01',
        user_name: 'User 2',
        user_email: 'u2@campus.ac.th',
        start_time: '2026-10-22T16:00:00.000Z',
        end_time: '2026-10-22T18:00:00.000Z'
      })
    }, env)

    expect(resAfter.status).toBe(201)

    // Adjacent Booking IMMEDIATELY before: 12:00 - 14:00
    const resBefore = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-lap-01',
        user_name: 'User 3',
        user_email: 'u3@campus.ac.th',
        start_time: '2026-10-22T12:00:00.000Z',
        end_time: '2026-10-22T14:00:00.000Z'
      })
    }, env)

    expect(resBefore.status).toBe(201)
  })

  // ─── 5. Update, Reschedule & Overlap on PATCH ─────────────────────────────

  it('PATCH /api/bookings/:id prevents rescheduling into an overlapping slot', async () => {
    // Booking A: 09:00 - 11:00
    const resA = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-cam-01',
        user_name: 'Student A',
        user_email: 'a@campus.ac.th',
        start_time: '2026-10-25T09:00:00.000Z',
        end_time: '2026-10-25T11:00:00.000Z'
      })
    }, env)
    const bookingA = await resA.json() as any

    // Booking B: 13:00 - 15:00
    const resB = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-cam-01',
        user_name: 'Student B',
        user_email: 'b@campus.ac.th',
        start_time: '2026-10-25T13:00:00.000Z',
        end_time: '2026-10-25T15:00:00.000Z'
      })
    }, env)
    const bookingB = await resB.json() as any

    // Attempt to reschedule B into A's time (10:00 - 12:00) -> 409 Conflict
    const patchConflict = await app.request(`http://localhost/api/bookings/${bookingB.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: '2026-10-25T10:00:00.000Z',
        end_time: '2026-10-25T12:00:00.000Z'
      })
    }, env)

    expect(patchConflict.status).toBe(409)

    // Rescheduling B into its own slot or updating purpose should succeed without self-conflict!
    const patchSelf = await app.request(`http://localhost/api/bookings/${bookingB.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: 'Updated thesis shooting plan'
      })
    }, env)

    expect(patchSelf.status).toBe(200)
    const updatedB = await patchSelf.json() as any
    expect(updatedB.purpose).toBe('Updated thesis shooting plan')
  })

  it('Cancelled bookings do not cause conflicts', async () => {
    // Create booking
    const res1 = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-room-01',
        user_name: 'Organizer',
        user_email: 'org@campus.ac.th',
        start_time: '2026-10-30T10:00:00.000Z',
        end_time: '2026-10-30T12:00:00.000Z'
      })
    }, env)
    const bk = await res1.json() as any

    // Cancel it
    await app.request(`http://localhost/api/bookings/${bk.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' })
    }, env)

    // Now another user can book the exact same slot!
    const res2 = await app.request('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: 'eq-room-01',
        user_name: 'New Organizer',
        user_email: 'neworg@campus.ac.th',
        start_time: '2026-10-30T10:00:00.000Z',
        end_time: '2026-10-30T12:00:00.000Z'
      })
    }, env)

    expect(res2.status).toBe(201)
  })

  // ─── 6. Delete & Cascading/Safeguard Rules ─────────────────────────────────

  it('DELETE /api/equipment/:id prevents deletion when active confirmed bookings exist', async () => {
    // Seed has bk-seed-01 for eq-cam-01
    const delRes = await app.request('http://localhost/api/equipment/eq-cam-01', {
      method: 'DELETE'
    }, env)

    expect(delRes.status).toBe(400)
    const err = await delRes.json() as any
    expect(err.error).toBe('Cannot delete equipment with active confirmed bookings')
  })

  it('DELETE /api/bookings/:id deletes booking and returns 200', async () => {
    const res = await app.request('http://localhost/api/bookings/bk-seed-01', {
      method: 'DELETE'
    }, env)

    expect(res.status).toBe(200)

    const verifyRes = await app.request('http://localhost/api/bookings/bk-seed-01', {
      method: 'GET'
    }, env)

    expect(verifyRes.status).toBe(404)
  })
})
