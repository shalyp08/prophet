import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build the base query
    let query = supabase
      .from('predictions')
      .select(`
        *,
        narrative_votes!inner (
          selected,
          count
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Add ticker filter if provided
    if (ticker) {
      query = query.eq('ticker', ticker);
    }

    const { data: predictions, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch predictions' },
        { status: 500 }
      );
    }

    // Transform the data to include vote counts
    const transformedPredictions = predictions.map(prediction => {
      const voteCounts = {
        bullish: 0,
        neutral: 0,
        bearish: 0
      };

      prediction.narrative_votes.forEach((vote: any) => {
        voteCounts[vote.selected as keyof typeof voteCounts] = vote.count;
      });

      return {
        ...prediction,
        vote_counts: voteCounts
      };
    });

    return NextResponse.json(transformedPredictions);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 