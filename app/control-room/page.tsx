'use client';

import React, { useState, useEffect } from 'react';
import { TradierService } from '@/lib/services/tradier';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Prediction {
  id: string;
  ticker: string;
  resolution_time: string;
  headline: string;
  narrative: string;
  iv_used?: number;
}

export default function ControlRoom() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [marketIV, setMarketIV] = useState<number | null>(null);
  const [overrideIV, setOverrideIV] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingPredictions();
  }, []);

  useEffect(() => {
    if (selectedPrediction) {
      fetchMarketIV();
    }
  }, [selectedPrediction]);

  const fetchPendingPredictions = async () => {
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPredictions(data || []);
    } catch (err) {
      setError('Failed to fetch predictions');
      console.error(err);
    }
  };

  const fetchMarketIV = async () => {
    if (!selectedPrediction) return;

    setIsLoading(true);
    setError(null);

    try {
      const tradier = TradierService.getInstance();
      const iv = await tradier.getImpliedVolatility(
        selectedPrediction.ticker,
        selectedPrediction.resolution_time
      );

      if (iv === null) {
        setError('Failed to fetch market IV');
      } else {
        setMarketIV(iv);
      }
    } catch (err) {
      setError('Error fetching market IV');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPrediction) return;

    setIsLoading(true);
    setError(null);

    try {
      const finalIV = overrideIV ? parseFloat(overrideIV) : marketIV;
      if (!finalIV) {
        throw new Error('No IV value available');
      }

      // Update prediction with IV
      const { error: updateError } = await supabase
        .from('predictions')
        .update({ iv_used: finalIV })
        .eq('id', selectedPrediction.id);

      if (updateError) throw updateError;

      // Call generate API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          predictionId: selectedPrediction.id,
          iv: finalIV,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate prediction');
      }

      // Refresh predictions
      await fetchPendingPredictions();
      setSelectedPrediction(null);
      setMarketIV(null);
      setOverrideIV('');
    } catch (err) {
      setError('Failed to approve prediction');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Control Room</h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pending Predictions</h2>
          <div className="space-y-2">
            {predictions.map((prediction) => (
              <div
                key={prediction.id}
                className={`p-4 border rounded-lg cursor-pointer ${
                  selectedPrediction?.id === prediction.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
                onClick={() => setSelectedPrediction(prediction)}
              >
                <div className="font-medium">{prediction.ticker}</div>
                <div className="text-sm text-gray-600">{prediction.headline}</div>
              </div>
            ))}
          </div>
        </div>

        {selectedPrediction && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review Prediction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ticker
                </label>
                <div className="mt-1">{selectedPrediction.ticker}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Resolution Time
                </label>
                <div className="mt-1">{selectedPrediction.resolution_time}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Headline
                </label>
                <div className="mt-1">{selectedPrediction.headline}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Narrative
                </label>
                <div className="mt-1">{selectedPrediction.narrative}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Market-Implied Volatility
                </label>
                <div className="mt-1">
                  {isLoading ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : marketIV ? (
                    <span>{marketIV.toFixed(1)}%</span>
                  ) : (
                    <span className="text-gray-500">Not available</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Override IV
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={overrideIV}
                  onChange={(e) => setOverrideIV(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter custom IV %"
                />
              </div>

              <button
                onClick={handleApprove}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 