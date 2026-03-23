-- Supabase Schema for Medline Appointment System

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  datetime_iso TIMESTAMPTZ NOT NULL,
  patient_name TEXT NOT NULL,
  patient_last_name TEXT NOT NULL,
  patient_phone TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  missed BOOLEAN DEFAULT FALSE,
  checked BOOLEAN DEFAULT FALSE
);


-- Note: Ensure "uuid-ossp" extension is enabled if using uuid_generate_v4()
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Simple policy for public access (adjust as needed for production)
-- For demonstration/development:
CREATE POLICY "Public Read/Write Access" ON bookings FOR ALL USING (true);
