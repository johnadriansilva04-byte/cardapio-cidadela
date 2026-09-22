import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { optimizedImageUrl, type ImageTransformOptions } from "@/lib/imageOptimization";

export interface SmartImageProps {
  src: string;
  alt: string;
  /** Largura sugerida para a transformação; ativa a URL otimizada. */
  width?: number;
  height?: number;
  quality?: number;
  resize?: ImageTransformOptions["resize"];
  className?: string;
  imgClassName?: string;
  /** Placeholder mostrado enquanto a imagem carrega. */
  fallback?: React.ReactNode;
  eager?: boolean;
  /** Formato alternativo para fallback (ex: 'jpeg', 'png'). */
  fallbackFormat?: 'jpeg' | 'png';
}

/**
 * Imagem que tenta a versão transformada do Supabase e cai para a original se
 * a transformação não estiver habilitada no projeto.
 *
 * A troca acontece via `onError`: quando o Supabase devolve 400 na rota de
 * render (recurso desligado), a gente re-renderiza com a URL crua em vez de
 * mostrar um ícone de imagem quebrada.
 */
export function SmartImage({
  src,
  alt,
  width,
  height,
  quality,
  resize,
  className,
  imgClassName,
  fallback,
  eager = false,
  fallbackFormat = 'jpeg',
}: SmartImageProps) {
  const optimized = optimizedImageUrl(src, { width, height, quality, resize, format: 'webp' });
  const [currentSrc, setCurrentSrc] = useState(optimized);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!eager);
  const [triedOriginal, setTriedOriginal] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(optimized);
    setFailed(false);
    setLoading(!eager);
    setTriedOriginal(false);
    setTriedFallback(false);
  }, [optimized, eager]);

  function handleError() {
    // Tenta a versão original se ainda não tentou
    if (!triedOriginal && currentSrc !== src) {
      setCurrentSrc(src);
      setTriedOriginal(true);
      return;
    }

    // Tenta fallback format se ainda não tentou
    if (!triedFallback && fallbackFormat) {
      const fallbackUrl = optimizedImageUrl(src, { width, height, quality, resize, format: fallbackFormat });
      if (fallbackUrl !== currentSrc) {
        setCurrentSrc(fallbackUrl);
        setTriedFallback(true);
        return;
      }
    }

    setFailed(true);
    setLoading(false);
  }

  function handleLoad() {
    setLoading(false);
  }

  if (failed) {
    return <>{fallback ?? <div className={cn("bg-white/5", className)} aria-hidden="true" />}</>;
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={handleError}
      onLoad={handleLoad}
      className={cn(imgClassName ?? className, loading && "opacity-0", !loading && "opacity-100 transition-opacity duration-300")}
    />
  );
}
