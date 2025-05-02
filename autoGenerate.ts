import dotenv from 'dotenv';
dotenv.config();

import Parser from 'rss-parser';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Set up Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Set up OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Set up RSS Parser
const parser = new Parser();
const FEED_URL = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US';

async function fetchHeadline() {
  const feed = await parser.parseURL(FEED_URL);
  return feed.items?.[0]?.title || '';
}

async function generateNarrative(headline: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: `Based on this headline: "${headline}", generate:
- A bullish narrative with expected SPY % move
- A neutral narrative
- A bearish narrative with expected SPY % move
- A suggested resolution time in ISO 8601 timestamp format like "2025-05-02T20:00:00Z"

Respond ONLY in valid JSON like:
{
  "bullish": "...",
  "neutral": "...",
  "bearish": "...",
  "bullish_pct": 2.0,
  "bearish_pct": -2.0,
  "resolution_time": "2025-05-02T20:00:00Z"
}`
      }
    ],
    temperature: 0.7
  });

  const text = response.choices[0]?.message?.content;
  console.log("📝 Raw GPT response:", text);

  try {
    return JSON.parse(text || '');
  } catch (err) {
    console.error("❌ Failed to parse GPT response:", err);
    return null;
  }
}

async function storeInSupabase(data: any, headline: string) {
  const { error } = await supabase.from('prophet').insert({
    headline,
    ...data,
    spy_at_start: 500
  });

  if (error) {
    console.error("❌ Error inserting into database:", error);
  } else {
    console.log("✅ Successfully inserted into Supabase!");
  }
}

async function main() {
  console.log("🚀 Starting autoGenerate script...");

  const headline = await fetchHeadline();
  console.log("📰 Latest headline:", headline);

  const narratives = await generateNarrative(headline);
  if (narratives) {
    console.log("📊 Generated narratives:", narratives);
    await storeInSupabase(narratives, headline);
  } else {
    console.error("❌ No narratives to store.");
  }
}

main();
