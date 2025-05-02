import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { prediction_id, selected, is_anonymous } = await request.json();

    // Get the prediction to validate the vote
    const { data: prediction, error: predictionError } = await supabase
      .from('predictions')
      .select('bullish_pct, neutral_pct, bearish_pct, status')
      .eq('id', prediction_id)
      .single();

    if (predictionError || !prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      );
    }

    if (prediction.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot vote on resolved prediction' },
        { status: 400 }
      );
    }

    // Get the selected percentage based on the narrative
    const selected_pct = {
      bullish: prediction.bullish_pct,
      neutral: prediction.neutral_pct,
      bearish: prediction.bearish_pct
    }[selected];

    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    const user_id = is_anonymous ? null : session?.user?.id;

    // Insert or update the vote
    const { data, error } = await supabase
      .from('narrative_votes')
      .upsert({
        prediction_id,
        user_id,
        selected,
        selected_pct,
        is_anonymous,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'prediction_id,user_id'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 