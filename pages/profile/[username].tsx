import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Prediction {
  id: string;
  headline: string;
  bullish: string;
  neutral: string;
  bearish: string;
  bullish_pct: number;
  bearish_pct: number;
  resolution_time: string;
  spy_at_start: number;
  spy_at_end: number | null;
  actual_return: number | null;
  resolved_narrative: string | null;
  correct: boolean | null;
  created_at: string;
}

interface ProfileProps {
  username: string;
  predictions: Prediction[];
  stats: {
    total_predictions: number;
    resolved_predictions: number;
    correct_predictions: number;
    accuracy: number;
  };
  sentiment: {
    netSentiment: '📈 Net Bullish' | '📉 Net Bearish' | '🤝 Net Neutral';
    bullishPct: number;
    bearishPct: number;
    neutralPct: number;
    trend: '↑ Increasing' | '↓ Decreasing' | '→ Stable';
  };
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { username } = context.params as { username: string };

  // Fetch all predictions for the user
  const { data: predictions, error } = await supabase
    .from('prophet')
    .select('*')
    .eq('created_by', username)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching predictions:', error);
    return {
      props: {
        username,
        predictions: [],
        stats: {
          total_predictions: 0,
          resolved_predictions: 0,
          correct_predictions: 0,
          accuracy: 0
        },
        sentiment: {
          netSentiment: '🤝 Net Neutral',
          bullishPct: 0,
          bearishPct: 0,
          neutralPct: 0,
          trend: '→ Stable'
        }
      }
    };
  }

  // Calculate stats
  const total_predictions = predictions.length;
  const resolved_predictions = predictions.filter(p => p.spy_at_end !== null).length;
  const correct_predictions = predictions.filter(p => p.correct === true).length;
  const accuracy = resolved_predictions > 0 
    ? (correct_predictions / resolved_predictions) * 100 
    : 0;

  // Calculate sentiment and trend
  const unresolvedPredictions = predictions.filter(p => p.spy_at_end === null);
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  // Get last 7 days of predictions for trend analysis
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentPredictions = predictions.filter(p => new Date(p.created_at) > sevenDaysAgo);
  
  const recentBullish = recentPredictions.filter(p => p.bullish_pct > Math.abs(p.bearish_pct)).length;
  const recentBearish = recentPredictions.filter(p => p.bearish_pct < 0 && Math.abs(p.bearish_pct) > p.bullish_pct).length;

  unresolvedPredictions.forEach(prediction => {
    if (prediction.bullish_pct > Math.abs(prediction.bearish_pct)) {
      bullishCount++;
    } else if (prediction.bearish_pct < 0 && Math.abs(prediction.bearish_pct) > prediction.bullish_pct) {
      bearishCount++;
    } else {
      neutralCount++;
    }
  });

  const totalUnresolved = unresolvedPredictions.length;
  const bullishPct = totalUnresolved > 0 ? (bullishCount / totalUnresolved) * 100 : 0;
  const bearishPct = totalUnresolved > 0 ? (bearishCount / totalUnresolved) * 100 : 0;
  const neutralPct = totalUnresolved > 0 ? (neutralCount / totalUnresolved) * 100 : 0;

  let netSentiment: '📈 Net Bullish' | '📉 Net Bearish' | '🤝 Net Neutral';
  if (bullishCount > bearishCount) {
    netSentiment = '📈 Net Bullish';
  } else if (bearishCount > bullishCount) {
    netSentiment = '📉 Net Bearish';
  } else {
    netSentiment = '🤝 Net Neutral';
  }

  // Calculate trend
  let trend: '↑ Increasing' | '↓ Decreasing' | '→ Stable';
  if (recentBullish > recentBearish && bullishCount > bearishCount) {
    trend = '↑ Increasing';
  } else if (recentBearish > recentBullish && bearishCount > bullishCount) {
    trend = '↓ Decreasing';
  } else {
    trend = '→ Stable';
  }

  return {
    props: {
      username,
      predictions,
      stats: {
        total_predictions,
        resolved_predictions,
        correct_predictions,
        accuracy: Number(accuracy.toFixed(1))
      },
      sentiment: {
        netSentiment,
        bullishPct: Number(bullishPct.toFixed(1)),
        bearishPct: Number(bearishPct.toFixed(1)),
        neutralPct: Number(neutralPct.toFixed(1)),
        trend
      }
    }
  };
};

export default function ProfilePage({ username, predictions, stats, sentiment }: ProfileProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const dailyData = last30Days.map(date => {
      const dayPredictions = predictions.filter(p => 
        p.created_at.startsWith(date)
      );
      
      const bullish = dayPredictions.filter(p => p.bullish_pct > Math.abs(p.bearish_pct)).length;
      const bearish = dayPredictions.filter(p => p.bearish_pct < 0 && Math.abs(p.bearish_pct) > p.bullish_pct).length;
      const neutral = dayPredictions.filter(p => 
        !(p.bullish_pct > Math.abs(p.bearish_pct)) && 
        !(p.bearish_pct < 0 && Math.abs(p.bearish_pct) > p.bullish_pct)
      ).length;

      const total = dayPredictions.length;
      return {
        date,
        bullish: total > 0 ? (bullish / total) * 100 : 0,
        bearish: total > 0 ? (bearish / total) * 100 : 0,
        neutral: total > 0 ? (neutral / total) * 100 : 0
      };
    });

    return {
      labels: dailyData.map(d => d.date),
      datasets: [
        {
          label: 'Bullish %',
          data: dailyData.map(d => d.bullish),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
        },
        {
          label: 'Bearish %',
          data: dailyData.map(d => d.bearish),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
        },
        {
          label: 'Neutral %',
          data: dailyData.map(d => d.neutral),
          borderColor: 'rgb(107, 114, 128)',
          backgroundColor: 'rgba(107, 114, 128, 0.5)',
        }
      ]
    };
  }, [predictions]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      {/* Profile Header */}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">
          @{username}
        </h1>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Predictions</p>
            <p className="text-xl font-semibold dark:text-white">{stats.total_predictions}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
            <p className="text-xl font-semibold dark:text-white">{stats.resolved_predictions}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Correct</p>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">
              {stats.correct_predictions}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
            <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
              {stats.accuracy}%
            </p>
          </div>
        </div>

        {/* Net Sentiment Signal */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Current Sentiment Signal</h2>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <p className={`text-3xl font-bold ${
                sentiment.netSentiment === '📈 Net Bullish' 
                  ? 'text-green-600 dark:text-green-400'
                  : sentiment.netSentiment === '📉 Net Bearish'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {sentiment.netSentiment}
              </p>
              <span className={`text-xl ${
                sentiment.trend === '↑ Increasing'
                  ? 'text-green-600 dark:text-green-400'
                  : sentiment.trend === '↓ Decreasing'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {sentiment.trend}
              </span>
            </div>
            <div className="flex justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-green-600 dark:text-green-400">
                {sentiment.bullishPct}% Bullish
              </span>
              <span>|</span>
              <span className="text-red-600 dark:text-red-400">
                {sentiment.bearishPct}% Bearish
              </span>
              <span>|</span>
              <span className="text-gray-600 dark:text-gray-400">
                {sentiment.neutralPct}% Neutral
              </span>
            </div>
          </div>
        </div>

        {/* Sentiment History Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Sentiment History (30 Days)</h2>
          <div className="h-64">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                    labels: {
                      color: '#6B7280',
                      font: {
                        size: 12
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      color: '#6B7280'
                    },
                    grid: {
                      color: 'rgba(107, 114, 128, 0.1)'
                    }
                  },
                  x: {
                    ticks: {
                      color: '#6B7280',
                      maxRotation: 45,
                      minRotation: 45
                    },
                    grid: {
                      color: 'rgba(107, 114, 128, 0.1)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Predictions List */}
        <div className="space-y-6">
          {predictions.length > 0 ? (
            predictions.map((prediction) => (
              <div 
                key={prediction.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
              >
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2 dark:text-white">
                    {prediction.headline}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Resolution: {new Date(prediction.resolution_time).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded border border-green-200 dark:border-green-800">
                    <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">
                      Bullish ({prediction.bullish_pct}%)
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{prediction.bullish}</p>
                  </div>
                  
                  <div className="p-4 rounded border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-2 text-gray-600 dark:text-gray-400">Neutral</h3>
                    <p className="text-gray-700 dark:text-gray-300">{prediction.neutral}</p>
                  </div>
                  
                  <div className="p-4 rounded border border-red-200 dark:border-red-800">
                    <h3 className="font-semibold mb-2 text-red-600 dark:text-red-400">
                      Bearish ({prediction.bearish_pct}%)
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{prediction.bearish}</p>
                  </div>
                </div>

                {prediction.spy_at_end && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">SPY at Start</p>
                        <p className="text-lg font-semibold dark:text-white">
                          ${prediction.spy_at_start.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">SPY at End</p>
                        <p className="text-lg font-semibold dark:text-white">
                          ${prediction.spy_at_end.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Actual Return</p>
                      <p className={`text-lg font-semibold ${
                        prediction.actual_return! >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {prediction.actual_return!.toFixed(2)}%
                      </p>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Outcome</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-lg font-semibold capitalize dark:text-white">
                          {prediction.resolved_narrative}
                        </p>
                        {prediction.correct !== null && (
                          <span className={`text-2xl ${
                            prediction.correct 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {prediction.correct ? '✅' : '❌'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2 dark:text-white">
                No predictions yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Start making predictions to see them here!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 