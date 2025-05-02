import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { assignTickerFromHeadline } from '../lib/tickerAssignment';

// Load environment variables
dotenv.config();

console.log('📡 Starting headline fetch from multiple sources...');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize RSS parser
const parser = new Parser();

// RSS feed URLs
const FEED_URLS = [
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
  'https://www.marketwatch.com/rss/topstories',
  'https://www.investing.com/rss/news_25.rss',
  'https://www.cnbc.com/id/100003114/device/rss/rss.html'
];

async function evaluateHeadlineWithGPT(headline: string): Promise<boolean> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an investment news filter. Given a headline, respond with either:\n- YES: if the headline is likely to cause price movement in SPY or large U.S. stocks\n- NO: if it is unlikely to matter to investors\n\nRespond ONLY with YES or NO."
        },
        {
          role: "user",
          content: `Headline: "${headline}"`
        }
      ],
      temperature: 0.1
    });

    const response = completion.choices[0]?.message?.content?.trim().toUpperCase();
    return response === 'YES';
  } catch (error) {
    console.error('❌ Error evaluating headline with GPT:', error);
    return false; // If GPT fails, skip the headline
  }
}

async function fetchFeed(url: string) {
  try {
    console.log(`🔍 Fetching feed: ${url}`);
    const feed = await parser.parseURL(url);
    return feed.items || [];
  } catch (error) {
    console.error(`❌ Error fetching feed ${url}:`, error);
    return [];
  }
}

async function insertHeadline(headline: string) {
  const ticker = assignTickerFromHeadline(headline);
  
  const { error } = await supabase
    .from('pending_headlines')
    .insert({
      headline,
      ticker,
      status: 'pending'
    });

  if (error) {
    console.error('Error inserting headline:', error);
    return false;
  }

  console.log(`Inserted headline with ticker ${ticker}: ${headline}`);
  return true;
}

async function main() {
  console.log(`📋 Checking ${FEED_URLS.length} feeds...`);
  let totalHeadlines = 0;
  let gptApprovedHeadlines = 0;
  let insertedHeadlines = 0;

  for (const url of FEED_URLS) {
    const items = await fetchFeed(url);
    totalHeadlines += items.length;
    console.log(`📰 Found ${items.length} headlines in ${url}`);

    for (const item of items) {
      if (item.title) {
        const isImportant = await evaluateHeadlineWithGPT(item.title);
        if (isImportant) {
          gptApprovedHeadlines++;
          console.log('⭐ GPT-approved headline:', item.title);
          const inserted = await insertHeadline(item.title);
          if (inserted) insertedHeadlines++;
        } else {
          console.log('⏭️ Skipping headline:', item.title);
        }
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`- Feeds checked: ${FEED_URLS.length}`);
  console.log(`- Total headlines parsed: ${totalHeadlines}`);
  console.log(`- GPT-approved headlines: ${gptApprovedHeadlines}`);
  console.log(`- New headlines inserted: ${insertedHeadlines}`);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 