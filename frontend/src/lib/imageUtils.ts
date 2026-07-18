/**
 * Client-side image compression utility using Canvas API.
 * Reduces file size while maintaining reasonable quality.
 * No external dependencies required.
 */

interface CompressOptions {
  maxWidth?: number;   // Max width in pixels
  maxHeight?: number;  // Max height in pixels
  quality?: number;    // JPEG quality 0.0–1.0
  format?: "image/jpeg" | "image/webp";
}

/**
 * Compress an image File/Blob to a Base64 data URL.
 * Typical result: 2MB photo → 80–150KB @ 800px/75% quality.
 */
export const compressImage = (
  file: File | Blob,
  options: CompressOptions = {}
): Promise<string> => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.75,
    format = "image/jpeg",
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate scaled dimensions while preserving aspect ratio
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Draw resized image onto canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        // White background for JPEG (transparent → white)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(format, quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

/**
 * Compress specifically for avatar photos.
 * 400×400px max, 80% quality — small enough for MongoDB storage.
 */
export const compressAvatar = (file: File): Promise<string> =>
  compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });

/**
 * Compress a QR code image.
 * QR codes need to stay sharp — use PNG-friendly quality settings.
 * 600×600px max, high quality.
 */
export const compressQRImage = (file: File): Promise<string> =>
  compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.92, format: "image/webp" });

/**
 * Get approximate file size from Base64 string (in KB).
 */
export const getBase64SizeKB = (base64: string): number => {
  const base64Data = base64.split(",")[1] || base64;
  return Math.round((base64Data.length * 3) / 4 / 1024);
};
