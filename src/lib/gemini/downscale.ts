const MAX_LONG_EDGE = 2200;
const JPEG_QUALITY = 0.82;

/**
 * Resize a document photo to max 2200 px long edge, JPEG quality 0.82.
 * The downscaled Blob (not the original) is sent to the API — saves
 * upload volume and tokens without hurting OCR quality.
 */
export async function downscale(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}
