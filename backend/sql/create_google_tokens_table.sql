-- Create table to store Google OAuth tokens persistently
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry_date BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only keep one token record (single calendar connection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tokens_singleton ON google_calendar_tokens ((true));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_google_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS google_tokens_updated_at ON google_calendar_tokens;

CREATE TRIGGER google_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_tokens_updated_at();

COMMENT ON TABLE google_calendar_tokens IS 'Stores Google Calendar OAuth tokens persistently';
