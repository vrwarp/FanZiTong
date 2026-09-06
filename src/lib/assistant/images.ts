/**
 * Preparing a photo for the model.
 *
 * A phone camera produces several megabytes; the model reads a picture at
 * about 1568 pixels on its longest edge, so shrinking first is both faster and
 * cheaper. Decoding through the browser also normalises HEIC and EXIF rotation.
 */
import { LIMITS } from './protocol';

const MAX_EDGE = 1568;

export interface PreparedImage {
  mediaType: 'image/jpeg';
  data: string;
  width: number;
  height: number;
}

export async function prepareImage(file: File | Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('That image could not be opened on this device.');
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not process the image.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (data.length > LIMITS.maxImageBytes) {
    throw new Error('That photo is too large even after shrinking; try a tighter crop.');
  }
  return { mediaType: 'image/jpeg', data, width, height };
}
