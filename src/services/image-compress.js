/** Client-side image compression before Gemini API upload. */

export const IMAGE_MAX_DIMENSION = 1024;
export const IMAGE_JPEG_QUALITY = 0.8;

export async function compressImage(file, maxDimension = IMAGE_MAX_DIMENSION, quality = IMAGE_JPEG_QUALITY) {
  if (!file || file.size === 0) {
    throw new Error('That file is empty — pick another photo');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Photo is too large — try one under 25 MB');
  }

  let workingFile = file;
  const name = (file.name || '').toLowerCase();
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  if (isHeic) {
    try {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      workingFile = new File([blob], name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (_) {
      throw new Error('Could not read iPhone photo — try JPG or PNG instead');
    }
  }

  return compressBlob(workingFile, workingFile.type || 'image/jpeg', maxDimension, quality);
}

/** Compress an existing data URL (native camera / live web camera). */
export async function compressDataUrl(dataUrl, mimeType = 'image/jpeg', maxDimension = IMAGE_MAX_DIMENSION, quality = IMAGE_JPEG_QUALITY) {
  if (!dataUrl) throw new Error('Photo was empty');
  const img = await loadImage(dataUrl);
  return canvasToPayload(img, maxDimension, quality, mimeType.startsWith('image/') ? mimeType : 'image/jpeg');
}

async function compressBlob(blob, mimeType, maxDimension, quality) {
  try {
    const img = await decodeBlob(blob);
    return canvasToPayload(img, maxDimension, quality, 'image/jpeg');
  } catch (_) {
    const raw = await blobToBase64(blob);
    if (!raw.base64 || raw.base64.length < 100) {
      throw new Error('Could not read this photo — try JPG or PNG');
    }
    return {
      ...raw,
      mimeType: raw.mimeType?.startsWith('image/') ? raw.mimeType : 'image/jpeg',
    };
  }
}

function canvasToPayload(img, maxDimension, quality, outMime) {
  let { width, height } = img;
  if (!width || !height) throw new Error('Could not read image dimensions');

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process photo');
  ctx.drawImage(img, 0, 0, width, height);

  const outMimeFinal = outMime === 'image/png' ? 'image/png' : 'image/jpeg';
  const q = outMimeFinal === 'image/png' ? undefined : quality;
  const compressed = canvas.toDataURL(outMimeFinal, q);
  if (compressed.length < 100) throw new Error('Photo export failed');

  return {
    dataUrl: compressed,
    base64: compressed.split(',')[1],
    mimeType: outMimeFinal,
  };
}

async function decodeBlob(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const img = await bitmapToImage(bitmap);
      bitmap.close?.();
      return img;
    } catch {
      /* fall through */
    }
  }
  const { dataUrl } = await blobToBase64(file);
  return loadImage(dataUrl);
}

function bitmapToImage(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return loadImage(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      resolve({
        base64: dataUrl.split(',')[1],
        dataUrl,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
