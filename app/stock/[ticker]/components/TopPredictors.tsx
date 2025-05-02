'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TopPredictor {
  created_by: string;
  correct_predictions: number;
  total_predictions: number;
  accuracy: number;
}

interface TopPredictorsProps {
  ticker: string;
}

export default function TopPredictors({ ticker }: TopPredictorsProps) {
  const [predictors, setPredictors] = useState<TopPredictor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopPredictors() {
      try {
        const { data, error } = await supabase
          .from('prophet')
          .select('created_by, is_correct')
          .eq('ticker', ticker)
          .eq('is_resolved', true);

        if (error) throw error;

        // Calculate accuracy for each user
        const userStats = data.reduce((acc: { [key: string]: TopPredictor }, prediction) => {
          if (!acc[prediction.created_by]) {
            acc[prediction.created_by] = {
              created_by: prediction.created_by,
              correct_predictions: 0,
              total_predictions: 0,
              accuracy: 0,
            };
          }

          acc[prediction.created_by].total_predictions++;
          if (prediction.is_correct) {
            acc[prediction.created_by].correct_predictions++;
          }

          acc[prediction.created_by].accuracy =
            (acc[prediction.created_by].correct_predictions /
              acc[prediction.created_by].total_predictions) *
            100;

          return acc;
        }, {});

        // Sort by accuracy and take top 5
        const topPredictors = Object.values(userStats)
          .sort((a, b) => b.accuracy - a.accuracy)
          .slice(0, 5);

        setPredictors(topPredictors);
      } catch (error) {
        console.error('Error fetching top predictors:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTopPredictors();
  }, [ticker]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Top Predictors</h2>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading...</div>
      ) : predictors.length > 0 ? (
        <div className="space-y-4">
          {predictors.map((predictor, index) => (
            <div
              key={predictor.created_by}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-semibold">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{predictor.created_by}</div>
                  <div className="text-sm text-gray-500">
                    {predictor.correct_predictions} correct predictions
                  </div>
                </div>
              </div>
              <div className="text-sm font-semibold text-green-600">
                {predictor.accuracy.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          No resolved predictions yet
        </div>
      )}
    </div>
  );
} 