import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface PredictionCardProps {
  prediction: {
    id: string;
    headline: string;
    ticker: string;
    bullish_pct: number;
    neutral_pct: number;
    bearish_pct: number;
    bullish_narrative: string;
    neutral_narrative: string;
    bearish_narrative: string;
    resolution_time: string;
    vote_counts?: {
      bullish: number;
      neutral: number;
      bearish: number;
    };
  };
  userVote?: string;
}

export default function PredictionCard({ prediction, userVote }: PredictionCardProps) {
  const [selectedNarrative, setSelectedNarrative] = useState<string | null>(userVote || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleVote = async (narrative: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('narrative_votes')
        .upsert({
          prediction_id: prediction.id,
          selected: narrative,
          selected_pct: {
            bullish: prediction.bullish_pct,
            neutral: prediction.neutral_pct,
            bearish: prediction.bearish_pct
          }[narrative],
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      setSelectedNarrative(narrative);
      router.refresh();
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const narratives = [
    {
      type: 'bullish',
      pct: prediction.bullish_pct,
      text: prediction.bullish_narrative,
      count: prediction.vote_counts?.bullish || 0,
    },
    {
      type: 'neutral',
      pct: prediction.neutral_pct,
      text: prediction.neutral_narrative,
      count: prediction.vote_counts?.neutral || 0,
    },
    {
      type: 'bearish',
      pct: prediction.bearish_pct,
      text: prediction.bearish_narrative,
      count: prediction.vote_counts?.bearish || 0,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold">{prediction.headline}</h2>
        <span className="text-sm text-gray-500">
          {new Date(prediction.resolution_time).toLocaleDateString()}
        </span>
      </div>

      <div className="space-y-4">
        {narratives.map((narrative) => (
          <div
            key={narrative.type}
            className={`p-4 rounded-lg border ${
              selectedNarrative === narrative.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } cursor-pointer transition-colors`}
            onClick={() => handleVote(narrative.type)}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium capitalize">{narrative.type}</span>
              <span className={`text-sm ${
                narrative.pct > 0 ? 'text-green-600' : 
                narrative.pct < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {narrative.pct > 0 ? '+' : ''}{narrative.pct}%
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-2">{narrative.text}</p>
            <div className="text-xs text-gray-500">
              {narrative.count} votes
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 