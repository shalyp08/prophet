import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { RateLimiter } from '../lib/rateLimiter';

// Load environment variables
dotenv.config();

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize rate limiter (5 requests per second)
const rateLimiter = new RateLimiter(5);

interface Prediction {
  id: string;
  ticker: string;
  resolution_time: string;
  bullish_pct: number;
  bearish_pct: number;
  status: string;
}

interface Vote {
  id: string;
  prediction_id: string;
  user_id: string;
  selected: string;
  selected_pct: number;
  is_correct: boolean | null;
}

interface VoteCount {
  bullish: number;
  neutral: number;
  bearish: number;
}

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        regularMarketPreviousClose: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: number[];
        }>;
      };
    }>;
  };
}

async function getCachedPrice(ticker: string, date: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('stock_prices')
    .select('price')
    .eq('symbol', ticker)
    .eq('date', date)
    .single();

  if (error || !data) return null;
  return data.price;
}

async function cachePrice(ticker: string, date: string, price: number): Promise<void> {
  await supabase
    .from('stock_prices')
    .upsert({
      symbol: ticker,
      date,
      price,
      updated_at: new Date().toISOString(),
    });
}

async function fetchYahooFinanceData(ticker: string, startDate: string, endDate: string): Promise<YahooFinanceResponse> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${Math.floor(new Date(startDate).getTime() / 1000)}&period2=${Math.floor(new Date(endDate).getTime() / 1000)}`
  );
  const data = await response.json();
  return data as YahooFinanceResponse;
}

function calculateActualReturn(startPrice: number, endPrice: number): number {
  return ((endPrice - startPrice) / startPrice) * 100;
}

function determineResolvedNarrative(actualReturn: number, bullishPct: number, bearishPct: number): string {
  if (actualReturn >= bullishPct) return 'bullish';
  if (actualReturn <= bearishPct) return 'bearish';
  return 'neutral';
}

async function getVotesForPrediction(predictionId: string): Promise<Vote[]> {
  const { data, error } = await supabase
    .from('narrative_votes')
    .select('*')
    .eq('prediction_id', predictionId);

  if (error) {
    console.error('Error fetching votes:', error);
    return [];
  }

  return data || [];
}

function countVotes(votes: Vote[]): VoteCount {
  return votes.reduce((acc, vote) => {
    acc[vote.selected as keyof VoteCount]++;
    return acc;
  }, { bullish: 0, neutral: 0, bearish: 0 });
}

function determineCommunityPick(voteCount: VoteCount): string {
  const maxVotes = Math.max(voteCount.bullish, voteCount.neutral, voteCount.bearish);
  if (maxVotes === 0) return 'neutral';

  if (voteCount.bullish === maxVotes) return 'bullish';
  if (voteCount.bearish === maxVotes) return 'bearish';
  return 'neutral';
}

async function updateVoteResults(votes: Vote[], resolvedNarrative: string): Promise<void> {
  const updates = votes.map(vote => ({
    id: vote.id,
    is_correct: vote.selected === resolvedNarrative,
  }));

  const { error } = await supabase
    .from('narrative_votes')
    .upsert(updates);

  if (error) {
    console.error('Error updating vote results:', error);
  }
}

async function updatePredictionCommunitySentiment(predictionId: string, communityPick: string): Promise<void> {
  const { error } = await supabase
    .from('predictions')
    .update({ community_sentiment_voted: communityPick })
    .eq('id', predictionId);

  if (error) {
    console.error('Error updating prediction community sentiment:', error);
  }
}

async function resolvePrediction(prediction: Prediction): Promise<void> {
  try {
    // Get start and end prices
    const startPrice = await getCachedPrice(prediction.ticker, prediction.resolution_time);
    const endDate = new Date(prediction.resolution_time);
    endDate.setDate(endDate.getDate() + 1);
    const endPrice = await getCachedPrice(prediction.ticker, endDate.toISOString().split('T')[0]);

    if (!startPrice || !endPrice) {
      console.log(`No cached prices found for ${prediction.ticker}, fetching from Yahoo Finance...`);
      const yahooData = await fetchYahooFinanceData(
        prediction.ticker,
        prediction.resolution_time,
        endDate.toISOString().split('T')[0]
      );

      const result = yahooData.chart.result[0];
      const startPrice = result.meta.regularMarketPreviousClose;
      const endPrice = result.meta.regularMarketPrice;

      // Cache the prices for future use
      await cachePrice(prediction.ticker, prediction.resolution_time, startPrice);
      await cachePrice(prediction.ticker, endDate.toISOString().split('T')[0], endPrice);
    }

    // Calculate actual return and resolved narrative
    const actualReturn = calculateActualReturn(startPrice!, endPrice!);
    const resolvedNarrative = determineResolvedNarrative(actualReturn, prediction.bullish_pct, prediction.bearish_pct);

    // Get and process votes
    const votes = await getVotesForPrediction(prediction.id);
    const voteCount = countVotes(votes);
    const communityPick = determineCommunityPick(voteCount);

    // Determine if community was correct
    const isCommunityCorrect = communityPick === resolvedNarrative;

    // Update vote results
    await updateVoteResults(votes, resolvedNarrative);

    // Update prediction with community sentiment
    await updatePredictionCommunitySentiment(prediction.id, communityPick);

    // Update prediction status
    const { error } = await supabase
      .from('predictions')
      .update({
        status: 'resolved',
        actual_return: actualReturn,
        resolved_narrative: resolvedNarrative,
        community_pick: communityPick,
        is_community_correct: isCommunityCorrect,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prediction.id);

    if (error) {
      console.error('Error updating prediction:', error);
      return;
    }

    console.log(`Resolved prediction ${prediction.id}:`);
    console.log(`- Actual Return: ${actualReturn.toFixed(2)}%`);
    console.log(`- Resolved Narrative: ${resolvedNarrative}`);
    console.log(`- Community Pick: ${communityPick}`);
    console.log(`- Community Correct: ${isCommunityCorrect}`);
    console.log(`- Vote Count: Bullish=${voteCount.bullish}, Neutral=${voteCount.neutral}, Bearish=${voteCount.bearish}`);

  } catch (error) {
    console.error(`Error resolving prediction ${prediction.id}:`, error);
  }
}

async function main() {
  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('status', 'pending')
      .lte('resolution_time', new Date().toISOString());

    if (error) {
      console.error('Error fetching predictions:', error);
      return;
    }

    if (!predictions || predictions.length === 0) {
      console.log('No predictions to resolve');
      return;
    }

    console.log(`Found ${predictions.length} predictions to resolve`);

    for (const prediction of predictions) {
      await resolvePrediction(prediction);
    }

  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main(); 