-- Add email column to help_requests table
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_help_requests_email 
ON help_requests(customer_email);

-- Add column to track if email was sent
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

-- Add timestamp for when email was sent
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
