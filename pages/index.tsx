import React, { useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import useSWR from 'swr';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// SWR fetcher function
const fetcher = async () => {
  const { data, error } = await supabase
    .from('prophet')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

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

type SortOption = 'newest' | 'oldest' | 'highest_return' | 'lowest_return' | 'correct' | 'incorrect';
type FilterOption = 'all' | 'resolved' | 'unresolved' | 'correct' | 'incorrect';

const ITEMS_PER_PAGE = 5;

export default function HomePage() {
  const { data: predictions, error } = useSWR<Prediction[]>('predictions', fetcher);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });

  // Filter and sort predictions
  const processedPredictions = useMemo(() => {
    if (!predictions) return [];

    let filtered = [...predictions];

    // Apply date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(prediction => {
        const createdDate = new Date(prediction.created_at);
        return createdDate >= new Date(dateRange.start) && 
               createdDate <= new Date(dateRange.end);
      });
    }

    // Apply status filter
    switch (filterBy) {
      case 'resolved':
        filtered = filtered.filter(p => p.spy_at_end !== null);
        break;
      case 'unresolved':
        filtered = filtered.filter(p => p.spy_at_end === null);
        break;
      case 'correct':
        filtered = filtered.filter(p => p.correct === true);
        break;
      case 'incorrect':
        filtered = filtered.filter(p => p.correct === false);
        break;
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'highest_return':
        filtered.sort((a, b) => (b.actual_return || 0) - (a.actual_return || 0));
        break;
      case 'lowest_return':
        filtered.sort((a, b) => (a.actual_return || 0) - (b.actual_return || 0));
        break;
      case 'correct':
        filtered.sort((a, b) => (b.correct ? 1 : 0) - (a.correct ? 1 : 0));
        break;
      case 'incorrect':
        filtered.sort((a, b) => (a.correct ? 1 : 0) - (b.correct ? 1 : 0));
        break;
    }

    return filtered;
  }, [predictions, sortBy, filterBy, dateRange]);

  // Pagination
  const totalPages = Math.ceil(processedPredictions.length / ITEMS_PER_PAGE);
  const paginatedPredictions = processedPredictions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (error) return <div className="p-4 text-red-500">Error loading predictions</div>;
  if (!predictions) return <div className="p-4">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Prophet Predictions</h1>

      {/* Filters and Controls */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filterBy}
            onChange={(e) => {
              setFilterBy(e.target.value as FilterOption);
              setCurrentPage(1);
            }}
            className="bg-white text-gray-800 rounded px-3 py-2 border border-gray-300"
          >
            <option value="all">All Predictions</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              setCurrentPage(1);
            }}
            className="bg-white text-gray-800 rounded px-3 py-2 border border-gray-300"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest_return">Highest Return</option>
            <option value="lowest_return">Lowest Return</option>
            <option value="correct">Most Correct</option>
            <option value="incorrect">Most Incorrect</option>
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-white text-gray-800 rounded px-3 py-2 border border-gray-300"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-white text-gray-800 rounded px-3 py-2 border border-gray-300"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-gray-600">Total Predictions</p>
            <p className="text-xl font-semibold">{processedPredictions.length}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-xl font-semibold">{processedPredictions.filter(p => p.spy_at_end !== null).length}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-gray-600">Correct</p>
            <p className="text-xl font-semibold text-green-600">{processedPredictions.filter(p => p.correct === true).length}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-gray-600">Incorrect</p>
            <p className="text-xl font-semibold text-red-600">{processedPredictions.filter(p => p.correct === false).length}</p>
          </div>
        </div>
      </div>
      
      {/* Predictions List */}
      <div className="space-y-6">
        {paginatedPredictions.map((prediction) => (
          <div 
            key={prediction.id}
            className="bg-white p-6 rounded-lg shadow"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">{prediction.headline}</h2>
              <p className="text-sm text-gray-500">
                Resolution: {new Date(prediction.resolution_time).toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded border border-green-200">
                <h3 className="font-semibold mb-2 text-green-600">
                  Bullish ({prediction.bullish_pct}%)
                </h3>
                <p className="text-gray-700">{prediction.bullish}</p>
              </div>
              
              <div className="p-4 rounded border border-gray-200">
                <h3 className="font-semibold mb-2 text-gray-600">Neutral</h3>
                <p className="text-gray-700">{prediction.neutral}</p>
              </div>
              
              <div className="p-4 rounded border border-red-200">
                <h3 className="font-semibold mb-2 text-red-600">
                  Bearish ({prediction.bearish_pct}%)
                </h3>
                <p className="text-gray-700">{prediction.bearish}</p>
              </div>
            </div>

            {prediction.spy_at_end && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">SPY at Start</p>
                    <p className="text-lg font-semibold">${prediction.spy_at_start.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">SPY at End</p>
                    <p className="text-lg font-semibold">${prediction.spy_at_end.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Actual Return</p>
                  <p className={`text-lg font-semibold ${prediction.actual_return! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {prediction.actual_return!.toFixed(2)}%
                  </p>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Outcome</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-lg font-semibold capitalize">{prediction.resolved_narrative}</p>
                    {prediction.correct !== null && (
                      <span className={`text-2xl ${
                        prediction.correct ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {prediction.correct ? '✅' : '❌'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {processedPredictions.length === 0 && (
          <div className="text-center text-gray-500 py-8 bg-white rounded-lg shadow">
            No predictions available
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white rounded shadow disabled:opacity-50 border border-gray-300"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white rounded shadow disabled:opacity-50 border border-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
} 