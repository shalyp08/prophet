interface Narrative {
  bullish: string;
  neutral: string;
  bearish: string;
  bullish_pct: number;
  bearish_pct: number;
  resolution_time: string;
}

export function isValidNarrative(parsed: any): { isValid: boolean; error?: string } {
  const requiredFields = ['bullish', 'neutral', 'bearish', 'bullish_pct', 'bearish_pct', 'resolution_time'];
  
  // Check if all required fields exist
  const missingFields = requiredFields.filter(field => !(field in parsed));
  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }
  
  // Check if all fields have values
  const missingValues = requiredFields.filter(field => parsed[field] === undefined || parsed[field] === null);
  if (missingValues.length > 0) {
    return {
      isValid: false,
      error: `Missing required field values: ${missingValues.join(', ')}`
    };
  }
  
  return { isValid: true };
} 