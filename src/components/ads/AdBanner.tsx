import { useEffect, useRef, useState } from 'react';
import { useScript } from '../../hooks/useScript';
import { AdErrorBoundary } from './AdErrorBoundary';

const ADSENSE_CLIENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_ADS_CLIENT_ID) ||
  'ca-pub-2783546143377409';

interface AdBannerProps {
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  className?: string;
}

export function AdBanner({ 
  adSlot, 
  adFormat = 'auto',
  fullWidthResponsive = true,
  className = ''
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load AdSense script safely
  const scriptStatus = useScript({
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`,
    async: true,
    crossOrigin: 'anonymous',
    onError: () => {
      console.error('[AdBanner] Failed to load AdSense script');
      setHasError(true);
    }
  });

  useEffect(() => {
    // Only initialize ad on client-side when script is ready and element exists
    if (
      typeof window !== 'undefined' &&
      scriptStatus === 'ready' &&
      adRef.current &&
      !isInitialized &&
      !hasError
    ) {
      try {
        // Check if adsbygoogle is available
        if (!window.adsbygoogle) {
          console.warn('[AdBanner] adsbygoogle not available');
          setHasError(true);
          return;
        }

        // Prevent duplicate initialization - check both possible attributes
        const adElement = adRef.current;
        if (
          adElement.getAttribute('data-ad-status') === 'filled' ||
          adElement.getAttribute('data-adsbygoogle-status') === 'done'
        ) {
          console.log('[AdBanner] Ad already filled');
          return;
        }

        // Initialize the ad
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setIsInitialized(true);
        console.log('[AdBanner] Ad initialized successfully');
      } catch (error) {
        console.error('[AdBanner] Error initializing ad:', error);
        setHasError(true);
      }
    }
  }, [scriptStatus, isInitialized, hasError]);

  // Evita mismatch de hidratação: SSR e primeiro paint client-side ficam iguais (null)
  if (!mounted || hasError || !ADSENSE_CLIENT_ID) {
    if (mounted && !ADSENSE_CLIENT_ID) {
      console.warn('[AdBanner] VITE_GOOGLE_ADS_CLIENT_ID não configurado — anúncio ignorado');
    }
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}

/** AdBanner isolado por Error Boundary — use este export em rotas/páginas. */
export function SafeAdBanner(props: AdBannerProps) {
  return (
    <AdErrorBoundary>
      <AdBanner {...props} />
    </AdErrorBoundary>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}
