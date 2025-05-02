-- Create stock_prices table
CREATE TABLE IF NOT EXISTS stock_prices (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  price DECIMAL NOT NULL,
  volume BIGINT NOT NULL,
  change DECIMAL NOT NULL,
  change_percent DECIMAL NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index on symbol for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol ON stock_prices(symbol);

-- Create index on updated_at for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_stock_prices_updated_at ON stock_prices(updated_at);

-- Add unique constraint on symbol to prevent duplicates
ALTER TABLE stock_prices ADD CONSTRAINT unique_stock_symbol UNIQUE (symbol);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_stock_prices_updated_at
  BEFORE UPDATE ON stock_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 