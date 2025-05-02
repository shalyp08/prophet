import dotenv from 'dotenv';
dotenv.config();

import Parser from 'rss-parser';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize RSS parser
const parser = new Parser();

// Constants
const FEED_URL = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US';
const DUMMY_SPY_VALUE = 500;

async function fetchLatestHeadline(): Promise<string> {
  try {
    const feed = await parser.parseURL(FEED_URL);
    if (!feed.items || feed.items.length === 0) {
      throw new Error('No headlines found in feed');
    }
    return feed.items[0].title || '';
  } catch (error) {
    console.error('❌ Error fetching headline:', error);
    throw error;
  }
}

async function generateNarratives(headline: string) {
  const prompt = `Respond ONLY with valid JSON using this schema:

{
  "bullish": "string",
  "neutral": "string",
  "bearish": "string",
  "bullish_pct": 2.0,
  "bearish_pct": -2.0,
  "resolution_time": "EOD next trading day"
}

Do NOT add any explanation or commentary. Just return valid JSON.

Headline: "${headline}"
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    temperature: 0.5,
    messages: [
      { role: "system", content: "You are a financial analyst. Always respond with strict JSON only." },
      { role: "user", content: prompt }
    ]
  });

  const raw = response.choices[0]?.message?.content?.trim();
  console.log("📝 Raw GPT response:", raw);

  const jsonMatch = raw?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("❌ GPT did not return a JSON object");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Convert "EOD next trading day" into a real timestamp
    if (parsed.resolution_time === "EOD next trading day") {
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setDate(now.getDate() + 1);
      nextDay.setUTCHours(20, 0, 0, 0); // 4pm ET = 8pm UTC
      parsed.resolution_time = nextDay.toISOString();
    }

    return parsed;
  } catch (e) {
    console.error("❌ Failed to parse GPT output as JSON");
    console.error("🧪 Raw text:", raw);
    throw e;
  }
}

async function insertIntoDatabase(headline: string, narratives: any) {
  try {
    const { error } = await supabase
      .from('prophet')
      .insert({
        headline,
        bullish: narratives.bullish,
        neutral: narratives.neutral,
        bearish: narratives.bearish,
        bullish_pct: narratives.bullish_pct,
        bearish_pct: narratives.bearish_pct,
        resolution_time: narratives.resolution_time,
        spy_at_start: DUMMY_SPY_VALUE
      });

    if (error) {
      throw error;
    }

    console.log('✅ Successfully inserted into database');
  } catch (error) {
    console.error('❌ Error inserting into database:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting autoGenerate script...');
    
    // Fetch latest headline
    const headline = await fetchLatestHeadline();
    console.log('📰 Latest headline:', headline);
    
    // Generate narratives
    const narratives = await generateNarratives(headline);
    console.log('📊 Generated narratives:', narratives);
    
    // Insert into database
    await insertIntoDatabase(headline, narratives);
    
    console.log('✨ Script completed successfully!');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main(); 