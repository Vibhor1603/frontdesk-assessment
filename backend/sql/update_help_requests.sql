-- Add missing columns to help_requests table

-- Add participant_id column if it doesn't exist
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS participant_id TEXT;

-- Add resolved_at column if it doesn't exist
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Add answered_at column if it doesn't exist
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;

-- Add answer column if it doesn't exist
ALTER TABLE help_requests 
ADD COLUMN IF NOT EXISTS answer TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_help_requests_status ON help_requests(status);
CREATE INDEX IF NOT EXISTS idx_help_requests_created_at ON help_requests(created_at DESC);

-- Update existing records to have proper status
UPDATE help_requests 
SET status = 'pending' 
WHERE status IS NULL;
