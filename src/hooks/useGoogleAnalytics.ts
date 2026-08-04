import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

const GA_MEASUREMENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID) ||
  'G-8WTB9PQBWH';

export function useGoogleAnalytics() {
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') {
      return;
    }

    if (!GA_MEASUREMENT_ID) {
      console.warn('[GoogleAnalytics] VITE_GA_MEASUREMENT_ID não configurado — analytics ignorado');
      return;
    }

    // Check if already loaded
    if (window.gtag) {
      return;
    }

    try {
      // Initialize dataLayer
      window.dataLayer = window.dataLayer || [];

      // Define gtag function
      window.gtag = function (...args: any[]) {
        window.dataLayer?.push(arguments);
      };

      // Load gtag.js script
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      script.async = true;
      
      script.onload = () => {
        // Configure GA after script loads
        window.gtag?.('js', new Date());
        window.gtag?.('config', GA_MEASUREMENT_ID);
        console.log('[GoogleAnalytics] Initialized successfully');
      };

      script.onerror = () => {
        console.error('[GoogleAnalytics] Failed to load gtag script');
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('[GoogleAnalytics] Error initializing:', error);
    }
  }, []);
}
