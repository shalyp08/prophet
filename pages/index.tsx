import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Prediction {
  id: number;
  headline: string;
  bullish: string;
  bullish_pct: number;
  neutral: string;
  bearish: string;
  bearish_pct: number;
  resolution_time: string;
  spy_at_end?: number;
  actual_return?: number;
  correct?: boolean;
}

export default function Home() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        const { data, error } = await supabase
          .from('prophet')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPredictions(data || []);
      } catch (error) {
        console.error('Error fetching predictions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPredictions();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading predictions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Prophet Predictions</h1>
      
      <div className="grid gap-6">
        {predictions.map((prediction) => (
          <div key={prediction.id} className="bg-gray-900 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">{prediction.headline}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-900/50 p-4 rounded">
                <h3 className="font-medium text-green-400">Bullish</h3>
                <p className="text-sm mt-1">{prediction.bullish}</p>
                <p className="text-green-400 mt-2">+{prediction.bullish_pct}%</p>
              </div>
              
              <div className="bg-gray-800 p-4 rounded">
                <h3 className="font-medium">Neutral</h3>
                <p className="text-sm mt-1">{prediction.neutral}</p>
              </div>
              
              <div className="bg-red-900/50 p-4 rounded">
                <h3 className="font-medium text-red-400">Bearish</h3>
                <p className="text-sm mt-1">{prediction.bearish}</p>
                <p className="text-red-400 mt-2">{prediction.bearish_pct}%</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-400">Resolution Time:</span>
                  <span className="ml-2">{formatDate(prediction.resolution_time)}</span>
                </div>
                
                {prediction.spy_at_end !== undefined && (
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-gray-400">SPY at End:</span>
                      <span className="ml-2">${prediction.spy_at_end.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Actual Return:</span>
                      <span className={`ml-2 ${prediction.actual_return! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {prediction.actual_return! >= 0 ? '+' : ''}{prediction.actual_return?.toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Correct:</span>
                      <span className="ml-2">
                        {prediction.correct ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 