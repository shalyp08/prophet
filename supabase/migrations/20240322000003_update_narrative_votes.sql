-- Update narrative_votes table
ALTER TABLE narrative_votes
ADD COLUMN IF NOT EXISTS selected_pct DECIMAL(5,2) NOT NULL,
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN narrative_votes.selected_pct IS 'The percentage move associated with the selected narrative';
COMMENT ON COLUMN narrative_votes.is_anonymous IS 'Whether the vote is anonymous';

-- Add check constraint for selected_pct
ALTER TABLE narrative_votes
ADD CONSTRAINT valid_selected_pct CHECK (
  (selected = 'bullish' AND selected_pct > 0) OR
  (selected = 'neutral' AND selected_pct = 0) OR
  (selected = 'bearish' AND selected_pct < 0)
);

-- Create view for user performance by ticker
CREATE OR REPLACE VIEW user_ticker_performance AS
SELECT 
  nv.user_id,
  p.ticker,
  COUNT(*) as total_votes,
  SUM(CASE WHEN nv.is_correct = true THEN 1 ELSE 0 END) as correct_votes,
  CASE 
    WHEN COUNT(*) > 0 THEN 
      (SUM(CASE WHEN nv.is_correct = true THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100 
    ELSE 0 
  END as accuracy_percentage
FROM narrative_votes nv
JOIN predictions p ON nv.prediction_id = p.id
WHERE p.status = 'resolved'
GROUP BY nv.user_id, p.ticker;

-- Add RLS policies for the view
ALTER VIEW user_ticker_performance SET (security_invoker = on);

-- Allow users to read their own performance
CREATE POLICY "Allow users to read their own ticker performance"
  ON user_ticker_performance FOR SELECT
  USING (auth.uid() = user_id); 