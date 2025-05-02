import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Prediction {
  id: number;
  spy_at_start: number;
  bullish_pct: number;
  bearish_pct: number;
}

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
      };
    }>;
  };
}

async function getUnresolvedPredictions(): Promise<Prediction[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('prophet')
    .select('id, spy_at_start, bullish_pct, bearish_pct')
    .lt('resolution_time', now)
    .is('spy_at_end', null);

  if (error) {
    console.error('Error fetching unresolved predictions:', error);
    throw error;
  }

  return data;
}

async function getCurrentSPYPrice(): Promise<number> {
  const response = await axios.get<YahooFinanceResponse>(
    'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d'
  );
  return response.data.chart.result[0].meta.regularMarketPrice;
}

function calculateReturn(startPrice: number, endPrice: number): number {
  return (endPrice - startPrice) / startPrice;
}

function determineNarrative(returnPct: number): 'bullish' | 'neutral' | 'bearish' {
  if (returnPct >= 0.015) return 'bullish';
  if (returnPct <= -0.015) return 'bearish';
  return 'neutral';
}

function isPredictionCorrect(
  expectedBullishPct: number,
  expectedBearishPct: number,
  actualReturn: number,
  actualNarrative: 'bullish' | 'neutral' | 'bearish'
): boolean {
  if (actualNarrative === 'neutral') return true;
  if (actualNarrative === 'bullish' && actualReturn >= expectedBullishPct) return true;
  if (actualNarrative === 'bearish' && actualReturn <= expectedBearishPct) return true;
  return false;
}

async function updatePrediction(
  id: number,
  spyAtEnd: number,
  actualReturn: number,
  resolvedNarrative: 'bullish' | 'neutral' | 'bearish',
  correct: boolean
) {
  const { error } = await supabase
    .from('prophet')
    .update({
      spy_at_end: spyAtEnd,
      actual_return: actualReturn,
      resolved_narrative: resolvedNarrative,
      correct: correct,
    })
    .eq('id', id);

  if (error) {
    console.error(`Error updating prediction ${id}:`, error);
    throw error;
  }
}

async function main() {
  try {
    const predictions = await getUnresolvedPredictions();
    if (predictions.length === 0) {
      console.log('No unresolved predictions found');
      return;
    }

    const currentSPYPrice = await getCurrentSPYPrice();
    console.log('Current SPY price:', currentSPYPrice);

    for (const prediction of predictions) {
      const actualReturn = calculateReturn(prediction.spy_at_start, currentSPYPrice);
      const resolvedNarrative = determineNarrative(actualReturn);
      const correct = isPredictionCorrect(
        prediction.bullish_pct,
        prediction.bearish_pct,
        actualReturn,
        resolvedNarrative
      );

      await updatePrediction(
        prediction.id,
        currentSPYPrice,
        actualReturn,
        resolvedNarrative,
        correct
      );

      console.log(`Updated prediction ${prediction.id}:`, {
        actualReturn,
        resolvedNarrative,
        correct,
      });
    }
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main(); 