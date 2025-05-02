import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserStats {
  total_votes: number;
  correct_votes: number;
  current_streak: number;
  longest_streak: number;
  accuracy: number;
}

interface TickerPerformance {
  ticker: string;
  total_votes: number;
  correct_votes: number;
  accuracy: number;
}

export default function UserProfile() {
  const router = useRouter();
  const { username } = router.query;
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [tickerPerformance, setTickerPerformance] = useState<TickerPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (!username) return;

      try {
        // Fetch user stats
        const { data: stats, error: statsError } = await supabase
          .from('user_stats')
          .select('*')
          .eq('username', username)
          .single();

        if (statsError) throw statsError;

        // Fetch ticker performance
        const { data: performance, error: perfError } = await supabase
          .from('ticker_performance')
          .select('*')
          .eq('username', username)
          .order('accuracy', { ascending: false });

        if (perfError) throw perfError;

        setUserStats(stats);
        setTickerPerformance(performance || []);
      } catch (err) {
        setError('Failed to fetch user data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [username]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!userStats) {
    return <div className="p-4">User not found</div>;
  }

  // Prepare chart data
  const chartData = {
    labels: tickerPerformance.map(t => t.ticker),
    datasets: [
      {
        label: 'Accuracy %',
        data: tickerPerformance.map(t => t.accuracy),
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{username}'s Profile</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
          <div className="space-y-4">
            <div>
              <span className="font-medium">Total Votes:</span> {userStats.total_votes}
            </div>
            <div>
              <span className="font-medium">Correct Votes:</span> {userStats.correct_votes}
            </div>
            <div>
              <span className="font-medium">Current Streak:</span> {userStats.current_streak}
            </div>
            <div>
              <span className="font-medium">Longest Streak:</span> {userStats.longest_streak}
            </div>
            <div>
              <span className="font-medium">Accuracy:</span> {userStats.accuracy.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Accuracy by Ticker</h2>
          <div className="h-64">
            <Line data={chartData} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Detailed Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Votes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct Votes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickerPerformance.map((ticker) => (
                <tr key={ticker.ticker}>
                  <td className="px-6 py-4 whitespace-nowrap">{ticker.ticker}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{ticker.total_votes}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{ticker.correct_votes}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{ticker.accuracy.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 