-- Supabase Schema for Medline Appointment System

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  datetimeIso TIMESTAMPTZ NOT NULL,
  patientName TEXT NOT NULL,
  patientLastName TEXT NOT NULL,
  patientPhone TEXT,
  createdBy TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedBy TEXT,
  updatedAt TIMESTAMPTZ,
  missed BOOLEAN DEFAULT FALSE,
  notified BOOLEAN DEFAULT FALSE
);

-- Note: Ensure "uuid-ossp" extension is enabled if using uuid_generate_v4()
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Simple policy for public access (adjust as needed for production)
-- For demonstration/development:
CREATE POLICY "Public Read/Write Access" ON bookings FOR ALL USING (true);
