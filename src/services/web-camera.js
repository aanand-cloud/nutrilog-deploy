/** Live in-app camera using getUserMedia (works on localhost & HTTPS). */
import { compressDataUrl, IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY } from './image-compress.js';

export function canUseWebCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

export function openWebCameraModal() {
  return new Promise((resolve, reject) => {
    if (!canUseWebCamera()) {
      reject(new Error('Camera needs HTTPS or localhost — use gallery instead'));
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'camera-modal';
    overlay.innerHTML = `
      <div class="camera-modal__panel">
        <video class="camera-modal__video" playsinline autoplay muted></video>
        <p class="camera-modal__hint">Point at your meal, then tap Capture</p>
        <div class="camera-modal__actions">
          <button type="button" class="btn btn-ghost" id="camCancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="camCapture">Capture</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const video = overlay.querySelector('video');
    let stream = null;

    function cleanup() {
      stream?.getTracks().forEach((t) => t.stop());
      overlay.remove();
      document.body.style.overflow = '';
    }

    overlay.querySelector('#camCancel').addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    overlay.querySelector('#camCapture').addEventListener('click', async () => {
      if (!video.videoWidth) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const raw = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
        cleanup();
        const compressed = await compressDataUrl(raw, 'image/jpeg', IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY);
        resolve(compressed);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
        },
        audio: false,
      })
      .then((s) => {
        stream = s;
        video.srcObject = s;
      })
      .catch((err) => {
        cleanup();
        reject(new Error(err.name === 'NotAllowedError' ? 'Camera permission denied' : 'Could not open camera'));
      });
  });
}
