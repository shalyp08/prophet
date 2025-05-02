'use client';

import React, { useState, useEffect } from 'react';
import { TradierService } from '@/lib/services/tradier';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

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
  bullish_pct: number;
  bearish_pct: number;
}

interface ValidationErrors {
  ticker?: string;
  resolution_time?: string;
  bullish_pct?: string;
  bearish_pct?: string;
  iv?: string;
}

export default function ControlRoom() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [marketIV, setMarketIV] = useState<number | null>(null);
  const [overrideIV, setOverrideIV] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    fetchPendingPredictions();
  }, []);

  useEffect(() => {
    if (selectedPrediction) {
      fetchMarketIV();
    }
  }, [selectedPrediction]);

  const validatePrediction = (prediction: Prediction): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!prediction.ticker) {
      errors.ticker = 'Ticker is required';
    }
    
    if (!prediction.resolution_time) {
      errors.resolution_time = 'Resolution time is required';
    }
    
    if (prediction.bullish_pct === undefined || prediction.bullish_pct === null) {
      errors.bullish_pct = 'Bullish percentage is required';
    }
    
    if (prediction.bearish_pct === undefined || prediction.bearish_pct === null) {
      errors.bearish_pct = 'Bearish percentage is required';
    }
    
    if (!marketIV && !overrideIV) {
      errors.iv = 'Either market IV or override IV is required';
    }
    
    return errors;
  };

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

    // Validate the prediction
    const errors = validatePrediction(selectedPrediction);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);
    setError(null);
    setValidationErrors({});

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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate prediction');
      }

      // Show success toast
      toast.success('Prediction approved successfully!');

      // Refresh predictions
      await fetchPendingPredictions();
      setSelectedPrediction(null);
      setMarketIV(null);
      setOverrideIV('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve prediction';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Control Room</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
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
                {validationErrors.ticker && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.ticker}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Resolution Time
                </label>
                <div className="mt-1">{selectedPrediction.resolution_time}</div>
                {validationErrors.resolution_time && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.resolution_time}</p>
                )}
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
                  Bullish Percentage
                </label>
                <div className="mt-1">{selectedPrediction.bullish_pct}%</div>
                {validationErrors.bullish_pct && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.bullish_pct}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Bearish Percentage
                </label>
                <div className="mt-1">{selectedPrediction.bearish_pct}%</div>
                {validationErrors.bearish_pct && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.bearish_pct}</p>
                )}
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
                {validationErrors.iv && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.iv}</p>
                )}
              </div>

              <button
                onClick={handleApprove}
                disabled={isLoading || Object.keys(validationErrors).length > 0}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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