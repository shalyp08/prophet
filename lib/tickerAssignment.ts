import companies from '../data/sp500_companies.json';

interface Company {
  ticker: string;
  name_variants: string[];
}

// Levenshtein distance implementation
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

// Check if a word is likely a company name
function isLikelyCompanyName(word: string): boolean {
  return word.length >= 3 && /^[A-Za-z]+$/.test(word);
}

// Extract potential company names from headline
function extractPotentialCompanies(headline: string): string[] {
  const words = headline.split(/\s+/);
  return words.filter(word => isLikelyCompanyName(word));
}

// Check for macroeconomic keywords
function isMacroEconomic(headline: string): boolean {
  const macroKeywords = [
    'fed', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'economy',
    'market', 'stocks', 'bonds', 'treasury', 'dollar', 'trade', 'tariff',
    'recession', 'growth', 'employment', 'unemployment', 'consumer', 'spending',
    'manufacturing', 'industrial', 'production', 'housing', 'real estate',
    'monetary', 'fiscal', 'policy', 'central bank', 'government', 'debt',
    'deficit', 'surplus', 'budget', 'tax', 'regulation', 'deregulation'
  ];
  
  const normalizedHeadline = headline.toLowerCase();
  return macroKeywords.some(keyword => normalizedHeadline.includes(keyword));
}

export function assignTickerFromHeadline(headline: string): string {
  const normalizedHeadline = headline.toLowerCase();
  
  // First try exact matches
  for (const company of companies) {
    for (const variant of company.name_variants) {
      if (normalizedHeadline.includes(variant.toLowerCase())) {
        console.log(`Exact match found: ${company.ticker} (${variant})`);
        return company.ticker;
      }
    }
  }

  // If no exact match, try fuzzy matching
  const potentialCompanies = extractPotentialCompanies(headline);
  let bestMatch: { ticker: string; distance: number } | null = null;
  const MAX_DISTANCE = 3; // Maximum allowed Levenshtein distance

  for (const word of potentialCompanies) {
    for (const company of companies) {
      for (const variant of company.name_variants) {
        const distance = levenshteinDistance(word.toLowerCase(), variant.toLowerCase());
        if (distance <= MAX_DISTANCE && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = { ticker: company.ticker, distance };
        }
      }
    }
  }

  if (bestMatch) {
    console.log(`Fuzzy matched ${headline} to ${bestMatch.ticker} (distance: ${bestMatch.distance})`);
    return bestMatch.ticker;
  }

  // Check for macro indicators
  if (isMacroEconomic(headline)) {
    console.log(`Macroeconomic headline detected: ${headline}`);
    return 'SPY';
  }

  // Default to SPY if no match found
  console.log(`No match found for headline: ${headline}, defaulting to SPY`);
  return 'SPY';
} 