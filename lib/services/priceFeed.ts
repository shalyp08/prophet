import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PriceUpdate {
  price: number;
  volume: number;
  change: number;
  changePercent: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

interface Logger {
  info: (message: string, data?: any) => void;
  error: (message: string, error: Error) => void;
  warn: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
}

class ConsoleLogger implements Logger {
  info(message: string, data?: any) {
    console.log(`[INFO] ${message}`, data ? data : '');
  }

  error(message: string, error: Error) {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(message: string, data?: any) {
    console.warn(`[WARN] ${message}`, data ? data : '');
  }

  debug(message: string, data?: any) {
    console.debug(`[DEBUG] ${message}`, data ? data : '');
  }
}

class PriceFeed {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<PriceUpdateCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private logger: Logger;
  private isConnected = false;

  constructor(logger: Logger = new ConsoleLogger()) {
    this.logger = logger;
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket('wss://streamer.finance.yahoo.com/');
      this.logger.info('Initializing WebSocket connection');

      this.ws.onopen = () => {
        this.isConnected = true;
        this.logger.info('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        // Resubscribe to all symbols
        this.subscribers.forEach((_, symbol) => {
          this.subscribeToSymbol(symbol);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.symbol && data.price) {
            const callbacks = this.subscribers.get(data.symbol);
            if (callbacks) {
              const update: PriceUpdate = {
                price: data.price,
                volume: data.volume || 0,
                change: data.change || 0,
                changePercent: data.changePercent || 0,
              };
              this.logger.debug(`Received price update for ${data.symbol}`, update);
              callbacks.forEach(callback => callback(update));
              this.cachePrice(data.symbol, update);
            }
          }
        } catch (error) {
          this.logger.error('Error processing WebSocket message', error as Error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.logger.warn('WebSocket disconnected', { code: event.code, reason: event.reason });
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        this.logger.error('WebSocket error occurred', error as Error);
        this.handleReconnect();
      };
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket connection', error as Error);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.logger.warn(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this.logger.error('Max reconnection attempts reached', new Error('Connection failed'));
    }
  }

  private subscribeToSymbol(symbol: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          subscribe: [symbol]
        }));
        this.logger.debug(`Subscribed to symbol: ${symbol}`);
      } catch (error) {
        this.logger.error(`Failed to subscribe to symbol: ${symbol}`, error as Error);
      }
    } else {
      this.logger.warn(`Cannot subscribe to ${symbol}: WebSocket not connected`);
    }
  }

  private async cachePrice(symbol: string, update: PriceUpdate) {
    try {
      const { error } = await supabase
        .from('stock_prices')
        .upsert({
          symbol,
          price: update.price,
          volume: update.volume,
          change: update.change,
          change_percent: update.changePercent,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error(`Failed to cache price for ${symbol}`, error);
      } else {
        this.logger.debug(`Cached price for ${symbol}`, update);
      }
    } catch (error) {
      this.logger.error(`Error caching price for ${symbol}`, error as Error);
    }
  }

  public subscribe(symbol: string, callback: PriceUpdateCallback): () => void {
    try {
      if (!this.subscribers.has(symbol)) {
        this.subscribers.set(symbol, new Set());
        this.logger.info(`New subscription for symbol: ${symbol}`);
      }
      this.subscribers.get(symbol)!.add(callback);
      this.subscribeToSymbol(symbol);

      return () => {
        const callbacks = this.subscribers.get(symbol);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.subscribers.delete(symbol);
            this.logger.info(`Removed last subscriber for symbol: ${symbol}`);
          }
        }
      };
    } catch (error) {
      this.logger.error(`Error in subscribe for ${symbol}`, error as Error);
      return () => {}; // Return empty cleanup function on error
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const priceFeed = new PriceFeed(); 