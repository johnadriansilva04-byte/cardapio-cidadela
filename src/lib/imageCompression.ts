// Compressão de imagens no navegador antes do upload.
//
// O bucket público do Supabase Storage não guarda Base64 nem arquivo pesado:
// a foto do produto é redimensionada para no máximo 800x800 e convertida para
// WebP a 70% de qualidade antes de sair do dispositivo. Assim o cardápio no
// celular do cliente baixa poucos KB por produto e o free tier do Storage
// demora muito mais para encher.
//
// Tudo degrada: se o navegador não souber gerar WebP, devolve o JPEG comprimido
// (ou o arquivo original) em vez de falhar o upload.

const MAX_DIMENSION = 800;
const WEBP_QUALITY = 0.7;

export interface CompressedImage {
  file: File;
  /** Dimensões finais, para log/telemetria. */
  width: number;
  height: number;
  /** Tamanho final em bytes. */
  size: number;
  /** `false` quando não foi possível comprimir e o original foi devolvido. */
  compressed: boolean;
}

/** Nome de arquivo com a extensão trocada (ex.: `foto.PNG` → `foto.webp`). */
function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "imagem";
  return `${base}.${ext}`;
}

/** Redimensiona mantendo a proporção; nunca aumenta uma imagem pequena. */
function targetSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION || longest === 0) return { width, height };
  const scale = MAX_DIMENSION / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* cai para o <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Falha ao ler a imagem."));
      img.src = url;
    });
    return img;
  } finally {
    // O <img> já decodificou; liberar o object URL não invalida o elemento.
    URL.revokeObjectURL(url);
  }
}

function drawToBlob(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", WEBP_QUALITY);
  });
}

/**
 * Comprime uma imagem para WebP ≤ 800x800. Devolve sempre um `File` utilizável:
 * em qualquer falha, devolve o original marcado com `compressed: false`.
 */
export async function compressImageForUpload(file: File): Promise<CompressedImage> {
  const original: CompressedImage = {
    file,
    width: 0,
    height: 0,
    size: file.size,
    compressed: false,
  };
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return original;

  let source: ImageBitmap | HTMLImageElement | null = null;
  try {
    source = await loadBitmap(file);
    const naturalWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
    const naturalHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
    const { width, height } = targetSize(naturalWidth, naturalHeight);

    const blob = await drawToBlob(source, width, height);
    if (!blob) return original;

    // Só aceita a versão comprimida se ela for realmente menor.
    if (blob.size >= file.size) return original;

    return {
      file: new File([blob], withExtension(file.name, "webp"), {
        type: "image/webp",
        lastModified: Date.now(),
      }),
      width,
      height,
      size: blob.size,
      compressed: true,
    };
  } catch {
    return original;
  } finally {
    if (source && "close" in source && typeof source.close === "function") source.close();
  }
}

// Reexport para teste (não usado em produção).
export const __internals = { targetSize };
