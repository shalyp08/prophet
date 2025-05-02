'use client';

import React from 'react';

interface SentimentScoreProps {
  data: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
}

export default function SentimentScore({ data }: SentimentScoreProps) {
  const total = data.bullish + data.bearish + data.neutral;
  const bullishPercent = total > 0 ? (data.bullish / total) * 100 : 0;
  const bearishPercent = total > 0 ? (data.bearish / total) * 100 : 0;
  const neutralPercent = total > 0 ? (data.neutral / total) * 100 : 0;

  const getSentimentEmoji = () => {
    if (bullishPercent > 60) return '📈';
    if (bearishPercent > 60) return '📉';
    return '➡️';
  };

  const getSentimentText = () => {
    if (bullishPercent > 60) return 'Net Bullish';
    if (bearishPercent > 60) return 'Net Bearish';
    return 'Neutral';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Community Sentiment</h2>
      
      <div className="flex items-center space-x-4">
        <div className="text-4xl">{getSentimentEmoji()}</div>
        <div>
          <div className="text-lg font-semibold">{getSentimentText()}</div>
          <div className="text-sm text-gray-500">
            {bullishPercent.toFixed(0)}% Bullish • {bearishPercent.toFixed(0)}% Bearish •{' '}
            {neutralPercent.toFixed(0)}% Neutral
          </div>
        </div>
      </div>

      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500"
          style={{ width: `${bullishPercent}%` }}
        />
        <div
          className="h-full bg-red-500"
          style={{ width: `${bearishPercent}%` }}
        />
        <div
          className="h-full bg-gray-400"
          style={{ width: `${neutralPercent}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-gray-500">
        <div>Total Predictions: {total}</div>
        <div>
          Bullish: {data.bullish} • Bearish: {data.bearish} • Neutral: {data.neutral}
        </div>
      </div>
    </div>
  );
} 