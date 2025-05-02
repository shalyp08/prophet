'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

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
  const [overrideIV, setOverrideIV] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    fetchPendingPredictions();
  }, []);

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
    
    if (!overrideIV) {
      errors.iv = 'IV is required';
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
      const finalIV = parseFloat(overrideIV);
      if (isNaN(finalIV)) {
        throw new Error('Invalid IV value');
      }

      // Log the values being sent
      console.log('Sending approval request with:', {
        predictionId: selectedPrediction.id,
        iv: finalIV
      });

      // Update prediction with IV
      const { error: updateError } = await supabase
        .from('predictions')
        .update({ iv_used: finalIV })
        .eq('id', selectedPrediction.id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error('Failed to update prediction with IV');
      }

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

      const data = await response.json();

      if (!response.ok) {
        console.error('API error response:', data);
        throw new Error(data.error || 'Failed to generate prediction');
      }

      // Show success toast
      toast.success('Prediction approved successfully!');

      // Refresh predictions
      await fetchPendingPredictions();
      setSelectedPrediction(null);
      setOverrideIV('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve prediction';
      console.error('Approval error:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
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
                    Implied Volatility
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={overrideIV}
                    onChange={(e) => setOverrideIV(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter IV %"
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
    </>
  );
} 