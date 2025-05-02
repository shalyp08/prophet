'use client';

import React, { useEffect, useState } from 'react';
import { priceFeed } from '@/lib/services/priceFeed';

interface StockInfoProps {
  data: {
    chart: {
      result: Array<{
        meta: {
          currency: string;
          symbol: string;
          regularMarketPrice: number;
          regularMarketVolume: number;
          marketCap: number;
          fiftyTwoWeekHigh: number;
          fiftyTwoWeekLow: number;
          regularMarketDayHigh: number;
          regularMarketDayLow: number;
          regularMarketPreviousClose: number;
          regularMarketOpen: number;
        };
      }>;
    };
  };
}

interface ErrorState {
  message: string;
  isError: boolean;
}

export default function StockInfo({ data }: StockInfoProps) {
  const [liveData, setLiveData] = useState<{
    price: number;
    volume: number;
    change: number;
    changePercent: number;
  } | null>(null);

  const [error, setError] = useState<ErrorState>({ message: '', isError: false });
  const [isConnected, setIsConnected] = useState(false);

  const stock = data.chart.result[0].meta;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = priceFeed.subscribe(stock.symbol, (update) => {
        setLiveData({
          price: update.price,
          volume: update.volume,
          change: update.change,
          changePercent: update.changePercent,
        });
        setError({ message: '', isError: false });
      });

      setIsConnected(priceFeed.getConnectionStatus());
    } catch (err) {
      setError({
        message: 'Failed to subscribe to price updates. Using cached data.',
        isError: true,
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [stock.symbol]);

  const currentPrice = liveData?.price || stock.regularMarketPrice;
  const currentVolume = liveData?.volume || stock.regularMarketVolume;
  const priceChange = liveData?.change || (currentPrice - stock.regularMarketPreviousClose);
  const priceChangePercent = liveData?.changePercent || 
    ((currentPrice - stock.regularMarketPreviousClose) / stock.regularMarketPreviousClose) * 100;

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Stock Information</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {error.isError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Current Price</div>
          <div className="text-lg font-semibold">
            {stock.currency} {currentPrice.toFixed(2)}
            {liveData && (
              <span className="ml-2 text-xs text-gray-500">(Live)</span>
            )}
          </div>
          <div
            className={`text-sm ${
              priceChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {priceChange >= 0 ? '+' : ''}
            {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Market Cap</div>
          <div className="text-lg font-semibold">
            {stock.currency} {formatNumber(stock.marketCap)}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Volume</div>
          <div className="text-lg font-semibold">
            {formatNumber(currentVolume)}
            {liveData && (
              <span className="ml-2 text-xs text-gray-500">(Live)</span>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">52 Week High</div>
          <div className="text-lg font-semibold">
            {stock.currency} {stock.fiftyTwoWeekHigh.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">52 Week Low</div>
          <div className="text-lg font-semibold">
            {stock.currency} {stock.fiftyTwoWeekLow.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Day Range</div>
          <div className="text-lg font-semibold">
            {stock.currency} {stock.regularMarketDayLow.toFixed(2)} -{' '}
            {stock.regularMarketDayHigh.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
} 