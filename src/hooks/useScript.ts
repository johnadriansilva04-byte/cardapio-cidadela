import { useEffect, useState } from 'react';

interface UseScriptOptions {
  src: string;
  async?: boolean;
  crossOrigin?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function useScript({ src, async = true, crossOrigin, onLoad, onError }: UseScriptOptions) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      setStatus('ready');
      onLoad?.();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = async;
    if (crossOrigin) {
      script.crossOrigin = crossOrigin;
    }

    const handleLoad = () => {
      setStatus('ready');
      onLoad?.();
    };

    const handleError = () => {
      setStatus('error');
      onError?.();
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, [src, async, crossOrigin, onLoad, onError]);

  return status;
}
