-- Update predictions table
ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS headline TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS bullish_pct DECIMAL(5,2) NOT NULL,
ADD COLUMN IF NOT EXISTS neutral_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bearish_pct DECIMAL(5,2) NOT NULL,
ADD COLUMN IF NOT EXISTS bullish_narrative TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS neutral_narrative TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS bearish_narrative TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS actual_return DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS resolved_narrative TEXT CHECK (resolved_narrative IN ('bullish', 'neutral', 'bearish')),
ADD COLUMN IF NOT EXISTS resolution_time TIMESTAMP WITH TIME ZONE NOT NULL;

-- Add comments
COMMENT ON COLUMN predictions.headline IS 'The news event or prediction headline';
COMMENT ON COLUMN predictions.bullish_pct IS 'Expected positive price move percentage';
COMMENT ON COLUMN predictions.neutral_pct IS 'Expected neutral price move percentage (usually 0)';
COMMENT ON COLUMN predictions.bearish_pct IS 'Expected negative price move percentage';
COMMENT ON COLUMN predictions.bullish_narrative IS 'GPT-generated bullish narrative';
COMMENT ON COLUMN predictions.neutral_narrative IS 'GPT-generated neutral narrative';
COMMENT ON COLUMN predictions.bearish_narrative IS 'GPT-generated bearish narrative';
COMMENT ON COLUMN predictions.actual_return IS 'Actual price movement percentage';
COMMENT ON COLUMN predictions.resolved_narrative IS 'The correct narrative based on actual price movement';
COMMENT ON COLUMN predictions.resolution_time IS 'When the prediction should be resolved';

-- Add check constraints
ALTER TABLE predictions
ADD CONSTRAINT valid_percentages CHECK (
  bullish_pct > 0 AND
  neutral_pct = 0 AND
  bearish_pct < 0
);

-- Create index for faster resolution queries
CREATE INDEX IF NOT EXISTS idx_predictions_resolution_time ON predictions(resolution_time) WHERE status = 'pending'; 