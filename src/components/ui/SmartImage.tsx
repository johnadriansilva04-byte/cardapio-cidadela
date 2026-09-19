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
}: SmartImageProps) {
  const optimized = optimizedImageUrl(src, { width, height, quality, resize });
  const [currentSrc, setCurrentSrc] = useState(optimized);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(optimized);
    setFailed(false);
  }, [optimized]);

  function handleError() {
    // Só tenta a original se ainda não estivermos nela.
    if (currentSrc !== src) {
      setCurrentSrc(src);
      return;
    }
    setFailed(true);
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
      className={cn(imgClassName ?? className)}
    />
  );
}
