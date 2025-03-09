"use client"
import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    createMyWidget?: (containerId: string, options: {
      autoSize: boolean;
      chainId: string;
      tokenAddress: string;
      defaultInterval: string;
      timeZone: string;
      theme: string;
      locale: string;
      backgroundColor: string;
      gridColor: string;
      textColor: string;
      candleUpColor: string;
      candleDownColor: string;
      hideLeftToolbar: boolean;
      hideTopToolbar: boolean;
      hideBottomToolbar: boolean;
    }) => void;
  }
}

const PRICE_CHART_ID = 'price-chart-widget-container';

export const PriceChartWidget = ({ tokenAddress }: { tokenAddress: string }) => {
  const containerRef = useRef(null);
    console.log(tokenAddress)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadWidget = () => {
      if (typeof window.createMyWidget === 'function') {
        window.createMyWidget(PRICE_CHART_ID, {
          autoSize: true,
          chainId: 'solana',
          tokenAddress,
          defaultInterval: '1D',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Etc/UTC',
          theme: 'moralis',
          locale: 'en',
          backgroundColor: '#0a0a0a',
          gridColor: '#0d2035',
          textColor: '#68738D',
          candleUpColor: '#4CE666',
          candleDownColor: '#E64C4C',
          hideLeftToolbar: false,
          hideTopToolbar: false,
          hideBottomToolbar: false
        });
      } else {
        console.error('createMyWidget function is not defined.');
      }
    };

    if (!document.getElementById('moralis-chart-widget')) {
      const script = document.createElement('script');
      script.id = 'moralis-chart-widget';
      script.src = 'https://moralis.com/static/embed/chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = loadWidget;
      script.onerror = () => {
        console.error('Failed to load the chart widget script.');
      };
      document.body.appendChild(script);
    } else {
      loadWidget();
    }
  }, [tokenAddress]);

  return (
    <div style={{ width: "100%", height: "100%" }} className='rounded-lg '>
      <div
        id={PRICE_CHART_ID}
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};