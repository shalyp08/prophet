import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface UserStats {
  total_votes: number;
  correct_votes: number;
  current_streak: number;
  longest_streak: number;
  accuracy_percentage: number;
}

interface TickerPerformance {
  ticker: string;
  total_votes: number;
  correct_votes: number;
  accuracy_percentage: number;
}

export default function UserProfile() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tickerPerformance, setTickerPerformance] = useState<TickerPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchUserStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user stats
        const { data: statsData } = await supabase
          .from('auth.users')
          .select('total_votes, correct_votes, current_streak, longest_streak')
          .eq('id', user.id)
          .single();

        if (statsData) {
          setStats({
            ...statsData,
            accuracy_percentage: statsData.total_votes > 0
              ? (statsData.correct_votes / statsData.total_votes) * 100
              : 0
          });
        }

        // Fetch ticker performance
        const { data: tickerData } = await supabase
          .from('user_ticker_performance')
          .select('*')
          .eq('user_id', user.id);

        if (tickerData) {
          setTickerPerformance(tickerData);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserStats();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!stats) {
    return <div>No stats available</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Your Performance</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total Votes</div>
            <div className="text-2xl font-bold">{stats.total_votes}</div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Correct Votes</div>
            <div className="text-2xl font-bold">{stats.correct_votes}</div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Accuracy</div>
            <div className="text-2xl font-bold">
              {stats.accuracy_percentage.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Current Streak</div>
            <div className="text-2xl font-bold">{stats.current_streak}</div>
            <div className="text-xs text-gray-500">
              Longest: {stats.longest_streak}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Performance by Ticker</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Ticker</th>
                <th className="px-4 py-2 text-right">Total Votes</th>
                <th className="px-4 py-2 text-right">Correct Votes</th>
                <th className="px-4 py-2 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {tickerPerformance.map((ticker) => (
                <tr key={ticker.ticker} className="border-t">
                  <td className="px-4 py-2">{ticker.ticker}</td>
                  <td className="px-4 py-2 text-right">{ticker.total_votes}</td>
                  <td className="px-4 py-2 text-right">{ticker.correct_votes}</td>
                  <td className="px-4 py-2 text-right">
                    {ticker.accuracy_percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 