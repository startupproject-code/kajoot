import { QuizSet } from '../shared/types';

export const MAX_IMAGE_DATA_URL_CHARS = 500_000;
export const MAX_FIRESTORE_QUIZ_BYTES = 950_000;
export const MAX_INLINE_VIDEO_BYTES = 450 * 1024;

export interface CompressedImageResult {
  dataUrl: string;
  originalBytes: number;
  finalChars: number;
  approxBytes: number;
  width: number;
  height: number;
}

const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT_REGEX.test(file.name);
}

export function estimateUtf8Bytes(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length * 2;
}

export function estimateQuizPayloadBytes(quiz: QuizSet): number {
  try {
    return estimateUtf8Bytes(JSON.stringify(quiz));
  } catch {
    return 0;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไม่สามารถประมวลผลไฟล์รูปภาพนี้ได้'));
    img.src = src;
  });
}

export async function compressImageFileToDataUrl(
  file: File,
  maxChars = MAX_IMAGE_DATA_URL_CHARS
): Promise<CompressedImageResult> {
  if (!isImageFile(file)) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP หรือ GIF)');
  }

  // Keep small SVG files intact if they fit safely within the limit
  if (file.type === 'image/svg+xml' && file.size <= maxChars * 0.7) {
    const svgDataUrl = await readFileAsDataUrl(file);
    if (svgDataUrl.length <= maxChars) {
      return {
        dataUrl: svgDataUrl,
        originalBytes: file.size,
        finalChars: svgDataUrl.length,
        approxBytes: Math.round(svgDataUrl.length * 0.75),
        width: 0,
        height: 0,
      };
    }
  }

  let objectUrl: string | null = null;
  let img: HTMLImageElement;
  try {
    objectUrl = URL.createObjectURL(file);
    img = await loadImageElement(objectUrl);
  } catch {
    const fallbackUrl = await readFileAsDataUrl(file);
    img = await loadImageElement(fallbackUrl);
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const naturalW = img.naturalWidth || img.width || 800;
  const naturalH = img.naturalHeight || img.height || 600;

  const maxDimensions = [1024, 800, 640, 480, 360];
  const qualities = [0.82, 0.68, 0.54, 0.42, 0.3];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('เบราว์เซอร์ไม่รองรับการย่อขนาดรูปภาพ');
  }

  let bestCandidate: CompressedImageResult | null = null;

  for (const maxDim of maxDimensions) {
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    canvas.width = targetW;
    canvas.height = targetH;

    for (const quality of qualities) {
      // Try WebP first (supports transparency and high compression), then JPEG fallback
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      let dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp')) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      } else {
        // Compare against JPEG on white canvas if WebP is unusually larger
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const jpegUrl = canvas.toDataURL('image/jpeg', quality);
        if (jpegUrl.length < dataUrl.length * 0.9) {
          dataUrl = jpegUrl;
        }
      }

      const candidate: CompressedImageResult = {
        dataUrl,
        originalBytes: file.size,
        finalChars: dataUrl.length,
        approxBytes: Math.round((dataUrl.length * 3) / 4),
        width: targetW,
        height: targetH,
      };

      if (!bestCandidate || candidate.finalChars < bestCandidate.finalChars) {
        bestCandidate = candidate;
      }

      if (candidate.finalChars <= maxChars) {
        return candidate;
      }
    }
  }

  if (bestCandidate && bestCandidate.finalChars <= maxChars) {
    return bestCandidate;
  }

  throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกิน 500KB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
}
