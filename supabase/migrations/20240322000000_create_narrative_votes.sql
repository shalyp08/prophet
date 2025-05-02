-- Create narrative_votes table
CREATE TABLE IF NOT EXISTS narrative_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  narrative TEXT NOT NULL CHECK (narrative IN ('bullish', 'neutral', 'bearish')),
  is_correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(prediction_id, user_id)
);

-- Add comment to explain the table
COMMENT ON TABLE narrative_votes IS 'Stores user votes for prediction narratives';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_narrative_votes_prediction_id ON narrative_votes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_narrative_votes_user_id ON narrative_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_narrative_votes_narrative ON narrative_votes(narrative);
CREATE INDEX IF NOT EXISTS idx_narrative_votes_is_correct ON narrative_votes(is_correct);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_narrative_votes_updated_at
  BEFORE UPDATE ON narrative_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE narrative_votes ENABLE ROW LEVEL SECURITY;

-- Allow users to read all votes
CREATE POLICY "Allow read access to all votes"
  ON narrative_votes FOR SELECT
  USING (true);

-- Allow users to insert their own votes
CREATE POLICY "Allow users to insert their own votes"
  ON narrative_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own votes
CREATE POLICY "Allow users to update their own votes"
  ON narrative_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service role to update is_correct
CREATE POLICY "Allow service role to update is_correct"
  ON narrative_votes FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role'); 