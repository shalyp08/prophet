import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { normalizeResolutionTime } from '../../lib/normalizeResolutionTime';
import { isValidNarrative } from '../../lib/validators';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { headline_id, resolution_time } = req.query;

  if (!headline_id) {
    return res.status(400).json({ error: 'Missing headline_id parameter' });
  }

  try {
    const { data: headlineRow, error: headlineError } = await supabase
      .from('pending_headlines')
      .select('*')
      .eq('id', headline_id)
      .single();

    if (headlineError || !headlineRow) {
      return res.status(404).json({ error: 'Headline not found' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a financial analyst generating market narratives. For each headline, generate:
1. A bullish narrative (why this is good for markets)
2. A neutral narrative (balanced view)
3. A bearish narrative (why this is bad for markets)
4. Bullish percentage (0-100)
5. Bearish percentage (0-100)
6. Resolution time (when the market will react)

Format your response as a JSON object with these exact keys:
{
  "bullish": "string",
  "neutral": "string",
  "bearish": "string",
  "bullish_pct": number,
  "bearish_pct": number,
  "resolution_time": "string"
}

Use double quotes for strings. Respond with ONLY the JSON object, no explanations.`
        },
        {
          role: "user",
          content: `Headline: "${headlineRow.headline}"`
        }
      ],
      temperature: 0.7
    });

    const gptResponse = completion.choices[0]?.message?.content;
    if (!gptResponse) {
      throw new Error('No response from GPT');
    }

    const parsed = JSON.parse(gptResponse);
    
    // Validate the narrative
    const validation = isValidNarrative(parsed);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Invalid GPT response', details: validation.error });
    }

    // Normalize resolution time if provided
    if (resolution_time) {
      parsed.resolution_time = normalizeResolutionTime(resolution_time as string);
    }

    const insertPayload = {
      headline: headlineRow.headline,
      bullish: parsed.bullish,
      neutral: parsed.neutral,
      bearish: parsed.bearish,
      bullish_pct: parsed.bullish_pct,
      bearish_pct: parsed.bearish_pct,
      resolution_time: parsed.resolution_time,
      created_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('prophet')
      .insert(insertPayload);

    if (insertError) {
      return res.status(500).json({
        error: "Failed to save narratives",
        details: insertError.message
      });
    }

    const { error: updateError } = await supabase
      .from('pending_headlines')
      .update({ status: 'approved' })
      .eq('id', headline_id);

    if (updateError) {
      return res.status(500).json({ 
        error: 'Failed to update headline status', 
        details: updateError.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Narratives generated and saved successfully',
      narratives: parsed
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 