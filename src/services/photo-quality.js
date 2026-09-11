/**
 * Client-side photo quality checks before analysis.
 * Honest signals only: file validity, brightness, blur. Completeness is asked of the user.
 */

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
export const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/jpg']);
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export function validatePhotoFile(file) {
  if (!file) return { ok: false, code: 'empty', message: 'Choose a photo to continue.' };
  const type = String(file.type || '').toLowerCase();
  const name = file.name || '';
  if (type && !ALLOWED_TYPES.has(type)) {
    return { ok: false, code: 'unsupported', message: 'Please use a JPG, PNG, WebP or HEIC photo.' };
  }
  if (!type && !ALLOWED_EXT.test(name)) {
    return { ok: false, code: 'unsupported', message: 'Please use a JPG, PNG, WebP or HEIC photo.' };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, code: 'too_large', message: 'That photo is too large. Choose a smaller image (under 25 MB).' };
  }
  if (file.size < 80) {
    return { ok: false, code: 'corrupt', message: 'That file looks damaged. Try another photo.' };
  }
  return { ok: true };
}

export function cameraErrorMessage(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (/permission|notallowed|denied/.test(msg)) {
    return {
      code: 'permission',
      message: 'Camera access was denied. Upload a photo instead.',
      offerUpload: true,
    };
  }
  if (/notfound|unavailable|no camera/.test(msg)) {
    return {
      code: 'unavailable',
      message: 'Camera is not available on this device. Upload a photo instead.',
      offerUpload: true,
    };
  }
  return { code: 'camera', message: err?.message || 'Could not open the camera.', offerUpload: true };
}

export async function assessPhotoQuality(dataUrl) {
  if (!dataUrl || typeof document === 'undefined') {
    return { ok: true, flags: [], summary: 'Photo looks clear', reduceConfidence: false };
  }
  try {
    const img = await loadImage(dataUrl);
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const luma = [];
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luma.push(y);
      sum += y;
    }
    const mean = sum / luma.length;
    let variance = 0;
    for (const y of luma) variance += (y - mean) ** 2;
    variance /= luma.length;

    const flags = [];
    if (img.naturalWidth < 240 || img.naturalHeight < 240) {
      flags.push({ code: 'too_far', message: 'The plate looks far away or the image is very small. Move closer, or continue with a wider calorie range.' });
    }
    if (mean < 38) flags.push({ code: 'dark', message: 'This photo looks very dark. Retake in better light for a more reliable estimate, or continue with a wider calorie range.' });
    if (mean > 230) flags.push({ code: 'overexposed', message: 'This photo looks overexposed. Retake with less glare, or continue with a wider calorie range.' });
    if (variance < 120) {
      flags.push({ code: 'no_food', message: 'No food is obvious in this photo. Retake a clearer picture of the meal.' });
    } else if (variance < 180) {
      flags.push({ code: 'blur', message: 'This photo may be blurry. Retake a sharper picture, or continue with a wider calorie range.' });
    }

    if (!flags.length) {
      return { ok: true, flags: [], summary: 'Photo looks clear', reduceConfidence: false, mean, variance };
    }
    return { ok: false, flags, summary: flags[0].message, reduceConfidence: true, mean, variance };
  } catch {
    return { ok: false, flags: [{ code: 'corrupt', message: 'Could not read that image. Try another photo.' }], summary: 'Could not read that image.', reduceConfidence: true };
  }
}

export async function rotateDataUrl(dataUrl, degrees = 90) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const swap = Math.abs(degrees) % 180 === 90;
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function cropCentreDataUrl(dataUrl, trim = 0.08) {
  const img = await loadImage(dataUrl);
  const sx = Math.round(img.width * trim);
  const sy = Math.round(img.height * trim);
  const sw = Math.round(img.width * (1 - trim * 2));
  const sh = Math.round(img.height * (1 - trim * 2));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}
