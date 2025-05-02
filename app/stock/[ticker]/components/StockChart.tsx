'use client';

import React, { useEffect, useState } from 'react';

interface StockChartProps {
  ticker: string;
}

export default function StockChart({ ticker }: StockChartProps) {
  const [timeframe, setTimeframe] = useState('1D');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{ticker} Price Chart</h2>
        <div className="flex space-x-2">
          {['1D', '1W', '1M'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded-md text-sm ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[400px]">
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${ticker}&symbol=${ticker}&interval=${timeframe}&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=light&style=1&timezone=exchange&withdateranges=1&showpopupbutton=1&popupwidth=1000&popupheight=650&locale=en`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          id={`tradingview_${ticker}`}
        />
      </div>
    </div>
  );
} 