'use client';

import React from 'react';

interface Prediction {
  id: string;
  created_at: string;
  created_by: string;
  predicted_direction: 'bullish' | 'bearish' | 'neutral';
  narrative: string;
  is_resolved: boolean;
  is_correct: boolean | null;
}

interface PredictionFeedProps {
  predictions: Prediction[];
}

export default function PredictionFeed({ predictions }: PredictionFeedProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDirectionEmoji = (direction: string) => {
    switch (direction) {
      case 'bullish':
        return '📈';
      case 'bearish':
        return '📉';
      default:
        return '➡️';
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'bullish':
        return 'bg-green-50 text-green-700';
      case 'bearish':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Recent Predictions</h2>
      
      <div className="space-y-4">
        {predictions.map((prediction) => (
          <div
            key={prediction.id}
            className="bg-white border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 rounded-full text-sm font-medium ${getDirectionColor(
                    prediction.predicted_direction
                  )}`}
                >
                  {getDirectionEmoji(prediction.predicted_direction)}{' '}
                  {prediction.predicted_direction.charAt(0).toUpperCase() +
                    prediction.predicted_direction.slice(1)}
                </span>
                {prediction.is_resolved && (
                  <span
                    className={`px-2 py-1 rounded-full text-sm font-medium ${
                      prediction.is_correct
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {prediction.is_correct ? '✅ Correct' : '❌ Incorrect'}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(prediction.created_at)}
              </div>
            </div>

            <p className="text-gray-700">{prediction.narrative}</p>

            <div className="flex items-center text-sm text-gray-500">
              <span>By {prediction.created_by}</span>
            </div>
          </div>
        ))}

        {predictions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No predictions available for this stock yet.
          </div>
        )}
      </div>
    </div>
  );
} 