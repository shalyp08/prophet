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
  private readonly baseUrl = 'https://sandbox.tradier.com/v1/markets/options/chains';
  private readonly apiKey: string;

  private constructor() {
    this.apiKey = process.env.TRADIER_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('TRADIER_API_KEY is not set');
    }
  }

  public static getInstance(): TradierService {
    if (!TradierService.instance) {
      TradierService.instance = new TradierService();
    }
    return TradierService.instance;
  }

  public async getImpliedVolatility(
    symbol: string,
    expiration: string
  ): Promise<number | null> {
    try {
      const response = await axios.get<TradierOptionsResponse>(this.baseUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        params: {
          symbol,
          expiration,
          greeks: true,
        },
      });

      const options = response.data.options.option;
      if (!options || options.length === 0) {
        return null;
      }

      // Find the option with the highest volume (or closest to current price)
      const sortedOptions = options.sort((a, b) => 
        Math.abs(a.strike - b.strike)
      );

      return sortedOptions[0].greeks.implied_volatility * 100; // Convert to percentage
    } catch (error) {
      console.error('Error fetching implied volatility:', error);
      return null;
    }
  }
} 