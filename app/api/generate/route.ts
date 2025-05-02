import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { predictionId, iv } = await request.json();

    if (!predictionId || !iv) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch the prediction
    const { data: prediction, error: fetchError } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', predictionId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Calculate expected move based on IV
    const daysToExpiration = Math.ceil(
      (new Date(prediction.resolution_time).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const expectedMove = iv * Math.sqrt(daysToExpiration / 365);

    // Update prediction with calculated values
    const { error: updateError } = await supabase
      .from('predictions')
      .update({
        status: 'approved',
        iv_used: iv,
        expected_move: expectedMove,
        updated_at: new Date().toISOString(),
      })
      .eq('id', predictionId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      prediction: {
        ...prediction,
        iv_used: iv,
        expected_move: expectedMove,
      },
    });
  } catch (error) {
    console.error('Error generating prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
} 