-- Add user statistics columns
ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS total_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS correct_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_vote_date TIMESTAMP WITH TIME ZONE;

-- Create function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  is_correct BOOLEAN;
  last_vote_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the user's last vote date
  SELECT last_vote_date INTO last_vote_date
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Update total votes
  UPDATE auth.users
  SET total_votes = total_votes + 1
  WHERE id = NEW.user_id;

  -- If vote is correct, update correct votes and streak
  IF NEW.is_correct = true THEN
    UPDATE auth.users
    SET 
      correct_votes = correct_votes + 1,
      current_streak = CASE 
        WHEN last_vote_date IS NULL OR last_vote_date < NOW() - INTERVAL '1 day' THEN 1
        ELSE current_streak + 1
      END,
      longest_streak = GREATEST(current_streak + 1, longest_streak),
      last_vote_date = NOW()
    WHERE id = NEW.user_id;
  ELSE
    -- Reset streak if vote is incorrect
    UPDATE auth.users
    SET 
      current_streak = 0,
      last_vote_date = NOW()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update user stats when a vote is updated
CREATE TRIGGER update_user_stats_trigger
  AFTER UPDATE OF is_correct ON narrative_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- Create view for user leaderboard
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT 
  id,
  email,
  total_votes,
  correct_votes,
  CASE 
    WHEN total_votes > 0 THEN (correct_votes::float / total_votes::float) * 100 
    ELSE 0 
  END as accuracy_percentage,
  current_streak,
  longest_streak
FROM auth.users
WHERE total_votes > 0
ORDER BY accuracy_percentage DESC, total_votes DESC;

-- Add RLS policies for the view
ALTER VIEW user_leaderboard SET (security_invoker = on);

-- Allow all users to read the leaderboard
CREATE POLICY "Allow read access to leaderboard"
  ON user_leaderboard FOR SELECT
  USING (true); 