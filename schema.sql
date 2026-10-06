-- Campus Equipment Booking Database Schema

CREATE TABLE IF NOT EXISTS equipment (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('CAMERA', 'PROJECTOR', 'MEETING_ROOM', 'LAPTOP', 'OTHER')),
  description TEXT,
  location    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'MAINTENANCE')),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_bookings_equipment_time ON bookings (equipment_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);

-- Seed Data for Testing & Demonstration
INSERT OR IGNORE INTO equipment (id, name, category, description, location, status) VALUES 
('eq-cam-01', 'Sony Alpha A7 IV (4K)', 'CAMERA', 'Full-frame mirrorless camera with 28-70mm lens and 2 batteries', 'Media Lab Room 402', 'AVAILABLE'),
('eq-proj-01', 'Epson EB-PU1007W 4K Laser', 'PROJECTOR', '7000-lumen laser projector with HDMI & wireless presentation', 'Smart Classroom 301', 'AVAILABLE'),
('eq-room-01', 'Active Learning Meeting Room A', 'MEETING_ROOM', 'Room with 12 seats, 75-inch smart touch display, videoconference bar', 'Innovation Center 2nd Fl', 'AVAILABLE'),
('eq-lap-01', 'MacBook Pro 16" M3 Max', 'LAPTOP', 'High-performance laptop for video editing and AI model training', 'Tech Hub 105', 'AVAILABLE');

INSERT OR IGNORE INTO bookings (id, equipment_id, user_name, user_email, start_time, end_time, status, purpose) VALUES
('bk-seed-01', 'eq-cam-01', 'Pechladda Duangkaew', 'pechladda.d@campus.ac.th', '2026-10-10T09:00:00.000Z', '2026-10-10T12:00:00.000Z', 'CONFIRMED', 'Filming student orientation video');
