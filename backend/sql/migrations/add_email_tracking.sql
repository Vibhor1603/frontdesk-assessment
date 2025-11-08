-- Add email tracking columns to help_requests table

ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;

ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Create supervisor_responses table to track all supervisor answers
CREATE TABLE IF NOT EXISTS supervisor_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id UUID REFERENCES help_requests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  customer_email TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  room_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_supervisor_responses_created_at 
ON supervisor_responses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supervisor_responses_help_request_id 
ON supervisor_responses(help_request_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supervisor_responses_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supervisor_responses_updated_at ON supervisor_responses;

CREATE TRIGGER supervisor_responses_updated_at
  BEFORE UPDATE ON supervisor_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_supervisor_responses_updated_at();

-- Update existing help_requests to set email_sent based on whether email exists
UPDATE help_requests 
SET email_sent = false 
WHERE email_sent IS NULL;

COMMENT ON TABLE supervisor_responses IS 'Tracks all supervisor responses for analytics and learning';
COMMENT ON COLUMN supervisor_responses.help_request_id IS 'Reference to the original help request';
COMMENT ON COLUMN supervisor_responses.email_sent IS 'Whether email was successfully sent to customer';
COMMENT ON COLUMN supervisor_responses.email_sent_at IS 'Timestamp when email was sent';
