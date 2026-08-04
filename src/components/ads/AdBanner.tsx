import { useEffect, useRef, useState } from 'react';
import { useScript } from '../../hooks/useScript';

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
  const adRef = useRef<HTMLElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Load AdSense script safely
  const scriptStatus = useScript({
    src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2783546143377409',
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

        // Prevent duplicate initialization
        const adElement = adRef.current;
        if (adElement.getAttribute('data-ad-status') === 'filled') {
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

  // Don't render anything if there's an error or on server-side
  if (hasError || typeof window === 'undefined') {
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2783546143377409"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}
