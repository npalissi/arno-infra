const MAX_WIDTH = 1920;
const QUALITY = 0.8;
const OUTPUT_TYPE = "image/jpeg";

/**
 * Compresse une image côté client via Canvas API.
 * - Redimensionne à max 1920px de large (conserve le ratio)
 * - Qualité JPEG 80%
 * - Retourne un Blob JPEG compressé
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let width = bitmap.width;
  let height = bitmap.height;

  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de créer le contexte Canvas 2D");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: OUTPUT_TYPE, quality: QUALITY });
  return blob;
}

/**
 * Compresse une image depuis une URL (télécharge puis compresse).
 * Utile pour les photos Auto1 importées (côté client).
 */
export async function compressImageFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Échec téléchargement image: ${url}`);

  const blob = await response.blob();
  return compressImage(blob);
}

/**
 * Compresse une image côté serveur via sharp.
 * - Redimensionne à max 1920px de large (sans agrandissement)
 * - Qualité JPEG 80%
 * - Retourne un Buffer JPEG compressé
 */
export async function compressImageServer(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buffer)
    .resize(1920, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}
