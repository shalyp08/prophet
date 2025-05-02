import dotenv from 'dotenv';
dotenv.config();

import Parser from 'rss-parser';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to get user input
const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function fetchHeadline() {
  const feed = await parser.parseURL(FEED_URL);
  return feed.items?.[0]?.title || '';
}

async function generateNarratives(headline: string) {
  const prompt = `You are a financial analyst. Given the following event summary, generate three distinct narratives:

1. A **bullish narrative** (why this event is good for the stock).
2. A **neutral narrative** (why the event might not significantly impact the stock).
3. A **bearish narrative** (why this event could be bad for the stock).

Each narrative should be concise, grounded in reasoning, and written in plain English for retail investors. Avoid exaggeration or hype. Highlight key financial or strategic impacts in each view.

**Event Summary:**
${headline}

**Ticker:** SPY (S&P 500 ETF)

**Sector:** Broad Market

Please format your output as valid JSON using this schema:
{
  "bullish": "string",
  "neutral": "string",
  "bearish": "string",
  "bullish_pct": 2.0,
  "bearish_pct": -2.0,
  "resolution_time": "EOD next trading day"
}

Do NOT add any explanation or commentary. Just return valid JSON.`;

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
  try {
    console.log('🚀 Starting autoGenerate script...');
    
    // Fetch latest headline
    const headline = await fetchHeadline();
    console.log('\n📰 Latest headline:', headline);
    
    // Ask for approval
    const answer = await askQuestion('\nGenerate narratives for this headline? (y/n): ');
    
    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Skipping headline. No narratives generated.');
      rl.close();
      return;
    }
    
    // Generate narratives
    console.log('\n🔄 Generating narratives...');
    const narratives = await generateNarratives(headline);
    console.log('📊 Generated narratives:', narratives);
    
    // Insert into database
    await storeInSupabase(narratives, headline);
    
    console.log('✨ Script completed successfully!');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
