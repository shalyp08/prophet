import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const predictionId = searchParams.get('predictionId');
    const iv = searchParams.get('iv');

    console.log('GET request received with:', { predictionId, iv });

    if (!predictionId || !iv) {
      return NextResponse.json(
        { error: 'Missing required fields: predictionId and iv are required' },
        { status: 400 }
      );
    }

    return await processPrediction(predictionId, parseFloat(iv));
  } catch (error) {
    console.error('Error in GET /api/generate:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { predictionId, iv } = body;

    console.log('POST request received with:', { predictionId, iv });

    if (!predictionId) {
      console.error('Missing predictionId');
      return NextResponse.json(
        { error: 'Missing required field: predictionId' },
        { status: 400 }
      );
    }

    if (!iv) {
      console.error('Missing iv');
      return NextResponse.json(
        { error: 'Missing required field: iv' },
        { status: 400 }
      );
    }

    return await processPrediction(predictionId, parseFloat(iv));
  } catch (error) {
    console.error('Error in POST /api/generate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}

async function processPrediction(predictionId: string, iv: number) {
  console.log('Processing prediction:', { predictionId, iv });

  // Fetch the prediction
  console.log('Fetching prediction from Supabase...');
  const { data: prediction, error: fetchError } = await supabase
    .from('predictions')
    .select('*')
    .eq('id', predictionId)
    .single();

  if (fetchError) {
    console.error('Error fetching prediction:', fetchError);
    throw new Error(`Failed to fetch prediction: ${fetchError.message}`);
  }

  if (!prediction) {
    console.error('Prediction not found:', predictionId);
    throw new Error(`Prediction not found: ${predictionId}`);
  }

  // Validate prediction data
  if (!prediction.resolution_time) {
    console.error('Missing resolution_time in prediction:', prediction);
    throw new Error('Prediction is missing resolution_time');
  }

  // Calculate expected move based on IV
  const daysToExpiration = Math.ceil(
    (new Date(prediction.resolution_time).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const expectedMove = iv * Math.sqrt(daysToExpiration / 365);

  console.log('Calculated values:', {
    daysToExpiration,
    expectedMove,
    resolutionTime: prediction.resolution_time,
    currentTime: new Date().toISOString()
  });

  // Update prediction with calculated values
  console.log('Updating prediction in Supabase...');
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
    console.error('Error updating prediction:', updateError);
    throw new Error(`Failed to update prediction: ${updateError.message}`);
  }

  console.log('Prediction updated successfully');
  return NextResponse.json({
    success: true,
    prediction: {
      ...prediction,
      iv_used: iv,
      expected_move: expectedMove,
    },
  });
} 