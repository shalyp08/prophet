import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import useSWR from 'swr';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PendingHeadline {
  id: string;
  headline: string;
  status: string;
  inserted_at: string;
}

// SWR fetcher function
const fetcher = async () => {
  const { data, error } = await supabase
    .from('pending_headlines')
    .select('*')
    .eq('status', 'pending')
    .order('inserted_at', { ascending: false });

  if (error) throw error;
  return data as PendingHeadline[];
};

// Resolution time options
const resolutionOptions = [
  { label: 'Next day close', value: 'next_day_close' },
  { label: '2 days later', value: '2_days' },
  { label: '3 days later', value: '3_days' },
  { label: '5 days later', value: '5_days' },
  { label: 'Next week', value: 'next_week' },
  { label: '2 weeks', value: '2_weeks' },
  { label: 'Custom date', value: 'custom' }
];

// Calculate UTC timestamp based on selection
const getResolutionTime = (option: string, customDate?: string): string => {
  const now = new Date();
  const utcHours = 16; // 4 PM UTC

  switch (option) {
    case 'next_day_close':
      return new Date(now.setDate(now.getDate() + 1)).setUTCHours(utcHours, 0, 0, 0).toString();
    case '2_days':
      return new Date(now.setDate(now.getDate() + 2)).setUTCHours(utcHours, 0, 0, 0).toString();
    case '3_days':
      return new Date(now.setDate(now.getDate() + 3)).setUTCHours(utcHours, 0, 0, 0).toString();
    case '5_days':
      return new Date(now.setDate(now.getDate() + 5)).setUTCHours(utcHours, 0, 0, 0).toString();
    case 'next_week':
      return new Date(now.setDate(now.getDate() + 7)).setUTCHours(utcHours, 0, 0, 0).toString();
    case '2_weeks':
      return new Date(now.setDate(now.getDate() + 14)).setUTCHours(utcHours, 0, 0, 0).toString();
    case 'custom':
      if (!customDate) return '';
      const custom = new Date(customDate);
      return custom.setUTCHours(utcHours, 0, 0, 0).toString();
    default:
      return '';
  }
};

export default function ControlPage() {
  const { data: headlines, error, mutate } = useSWR<PendingHeadline[]>('pending-headlines', fetcher);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedResolution, setSelectedResolution] = useState<{ [key: string]: string }>({});
  const [customDates, setCustomDates] = useState<{ [key: string]: string }>({});

  const handleResolutionChange = (headlineId: string, value: string) => {
    setSelectedResolution(prev => ({ ...prev, [headlineId]: value }));
    if (value !== 'custom') {
      setCustomDates(prev => ({ ...prev, [headlineId]: '' }));
    }
  };

  const handleCustomDateChange = (headlineId: string, date: string) => {
    setCustomDates(prev => ({ ...prev, [headlineId]: date }));
  };

  const handleApprove = async (id: string) => {
    console.log("🔁 Approving headline:", id);
    
    const resolutionOption = selectedResolution[id];
    if (!resolutionOption) {
      alert("Please select a resolution time");
      return;
    }

    const resolutionTime = getResolutionTime(resolutionOption, customDates[id]);
    if (!resolutionTime) {
      alert("Invalid resolution time selected");
      return;
    }

    try {
      const res = await fetch(`/api/generate?headline_id=${id}&resolution_time=${encodeURIComponent(resolutionTime)}`);
      const json = await res.json();

      if (!res.ok) {
        console.error("❌ API error:", json);
        alert(`Failed to approve: ${json.error || 'Unknown error'}`);
        return;
      }

      console.log("✅ Approved successfully:", json);
      mutate(); // Refresh pending headlines
    } catch (err) {
      console.error("❌ Network error:", err);
      alert("Something went wrong during approval.");
    }
  };

  const handleReject = async (headlineId: string) => {
    try {
      setLoading(prev => ({ ...prev, [headlineId]: true }));

      const { error } = await supabase
        .from('pending_headlines')
        .update({ status: 'rejected' })
        .eq('id', headlineId);

      if (error) throw error;

      mutate(headlines?.filter(h => h.id !== headlineId), false);
    } catch (error) {
      console.error('Error rejecting headline:', error);
      alert('Failed to reject headline. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, [headlineId]: false }));
    }
  };

  if (error) return <div className="p-4 text-red-500">Error loading headlines</div>;
  if (!headlines) return <div className="p-4">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Headline Control Panel</h1>
      
      <div className="space-y-4">
        {headlines.map((headline) => (
          <div 
            key={headline.id}
            className="bg-gray-800 p-4 rounded-lg flex flex-col space-y-4"
          >
            <div className="flex-1">
              <p className="text-lg">{headline.headline}</p>
              <p className="text-sm text-gray-400">
                {new Date(headline.inserted_at).toLocaleString()}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <select
                  value={selectedResolution[headline.id] || ''}
                  onChange={(e) => handleResolutionChange(headline.id, e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <option value="">Select resolution time</option>
                  {resolutionOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                {selectedResolution[headline.id] === 'custom' && (
                  <input
                    type="date"
                    value={customDates[headline.id] || ''}
                    onChange={(e) => handleCustomDateChange(headline.id, e.target.value)}
                    className="mt-2 w-full bg-gray-700 text-white rounded px-3 py-2"
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleApprove(headline.id)}
                  disabled={loading[headline.id] || !selectedResolution[headline.id]}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading[headline.id] ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      <span>Approve</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleReject(headline.id)}
                  disabled={loading[headline.id]}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading[headline.id] ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>❌</span>
                      <span>Reject</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {headlines.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            No pending headlines to review
          </div>
        )}
      </div>
    </div>
  );
} 