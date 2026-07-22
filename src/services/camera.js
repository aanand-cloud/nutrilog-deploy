import { Capacitor } from '@capacitor/core';
import { compressDataUrl, IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY } from './image-compress.js';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/**
 * Capture a meal photo. Uses Capacitor Camera on Android/iOS;
 * returns null on web so the caller can fall back to file input.
 */
export async function captureMealPhoto() {
  if (!isNativeApp()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    const perm = await Camera.checkPermissions();
    if (perm.camera !== 'granted') {
      const req = await Camera.requestPermissions({ permissions: ['camera'] });
      if (req.camera !== 'granted') {
        throw new Error('Camera permission denied');
      }
    }

    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    if (!photo.dataUrl) return null;

    const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    return compressDataUrl(photo.dataUrl, mimeType, IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY);
  } catch (err) {
    if (err?.message === 'User cancelled photos app') return null;
    throw err;
  }
}

export async function pickMealPhotoFromGallery() {
  if (!isNativeApp()) return null;

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    correctOrientation: true,
  });

  if (!photo.dataUrl) return null;
  const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
  return compressDataUrl(photo.dataUrl, mimeType, IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY);
}
