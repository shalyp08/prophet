import axios from 'axios';

interface TradierOptionsResponse {
  options: {
    option: Array<{
      strike: number;
      greeks: {
        implied_volatility: number;
      };
    }>;
  };
}

export class TradierService {
  private static instance: TradierService;
  private apiKey: string;
  private baseUrl: string;

  private constructor() {
    this.apiKey = process.env.TRADIER_API_KEY || '';
    this.baseUrl = 'https://api.tradier.com/v1';
  }

  public static getInstance(): TradierService {
    if (!TradierService.instance) {
      TradierService.instance = new TradierService();
    }
    return TradierService.instance;
  }

  public async getImpliedVolatility(ticker: string, expiration: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets/options/chains?symbol=${ticker}&expiration=${expiration}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch IV data: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract IV from the response
      // This is a simplified example - adjust based on actual API response structure
      const iv = data?.options?.option?.[0]?.greeks?.iv;
      
      return iv ? parseFloat(iv) * 100 : null; // Convert to percentage
    } catch (error) {
      console.error('Error fetching IV data:', error);
      return null;
    }
  }
} 