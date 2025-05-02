-- Add IV-related columns to predictions table
ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS iv_used DECIMAL,
ADD COLUMN IF NOT EXISTS expected_move DECIMAL,
ADD COLUMN IF NOT EXISTS market_iv DECIMAL;

-- Add comment to explain the columns
COMMENT ON COLUMN predictions.iv_used IS 'The implied volatility used for the prediction (either market or overridden)';
COMMENT ON COLUMN predictions.expected_move IS 'The expected move calculated from IV and time to expiration';
COMMENT ON COLUMN predictions.market_iv IS 'The market-implied volatility at the time of prediction';

-- Add check constraint to ensure IV values are reasonable
ALTER TABLE predictions
ADD CONSTRAINT iv_used_check CHECK (iv_used >= 0 AND iv_used <= 100),
ADD CONSTRAINT market_iv_check CHECK (market_iv >= 0 AND market_iv <= 100),
ADD CONSTRAINT expected_move_check CHECK (expected_move >= 0);

-- Create index for faster queries on IV-related columns
CREATE INDEX IF NOT EXISTS idx_predictions_iv_used ON predictions(iv_used);
CREATE INDEX IF NOT EXISTS idx_predictions_market_iv ON predictions(market_iv);
CREATE INDEX IF NOT EXISTS idx_predictions_expected_move ON predictions(expected_move); 