import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import StockChart from './components/StockChart';
import StockInfo from './components/StockInfo';
import SentimentScore from './components/SentimentScore';
import PredictionFeed from './components/PredictionFeed';
import TopPredictors from './components/TopPredictors';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StockPageProps {
  params: {
    ticker: string;
  };
}

export default async function StockPage({ params }: StockPageProps) {
  const { ticker } = params;

  // Fetch stock data from Yahoo Finance API
  const stockData = await fetchStockData(ticker);
  if (!stockData) {
    notFound();
  }

  // Fetch predictions and sentiment data
  const { predictions, sentiment } = await fetchPredictionData(ticker);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stock Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <StockChart ticker={ticker} />
            </div>

            {/* Stock Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <StockInfo data={stockData} />
            </div>

            {/* Sentiment Score */}
            <div className="bg-white rounded-lg shadow p-6">
              <SentimentScore data={sentiment} />
            </div>

            {/* Prediction Feed */}
            <div className="bg-white rounded-lg shadow p-6">
              <PredictionFeed predictions={predictions} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <TopPredictors ticker={ticker} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchStockData(ticker: string) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return null;
  }
}

async function fetchPredictionData(ticker: string) {
  try {
    // Fetch predictions for this ticker
    const { data: predictions } = await supabase
      .from('prophet')
      .select('*')
      .eq('ticker', ticker)
      .order('created_at', { ascending: false });

    // Calculate sentiment
    const sentiment = {
      bullish: predictions?.filter(p => p.predicted_direction === 'bullish').length || 0,
      bearish: predictions?.filter(p => p.predicted_direction === 'bearish').length || 0,
      neutral: predictions?.filter(p => p.predicted_direction === 'neutral').length || 0,
    };

    return { predictions, sentiment };
  } catch (error) {
    console.error('Error fetching prediction data:', error);
    return { predictions: [], sentiment: { bullish: 0, bearish: 0, neutral: 0 } };
  }
} 