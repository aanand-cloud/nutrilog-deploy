/** Barcode scan via camera, photo, or manual entry. */

export function canUseBarcodeCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

function nativeDetector() {
  if (!window.BarcodeDetector) return null;
  try {
    return new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    });
  } catch {
    try {
      return new window.BarcodeDetector();
    } catch {
      return null;
    }
  }
}

function cameraErrorMessage(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
    return 'Camera permission blocked. Tap Start camera, type the number, or upload a photo.';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return 'No camera found. Type the number or upload a photo.';
  }
  if (!window.isSecureContext) {
    return 'Camera needs HTTPS. Type the number or upload a photo.';
  }
  return 'Camera unavailable. Tap Start camera, type the number, or upload a photo.';
}

async function loadZxing() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

async function decodeImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const detector = nativeDetector();
    if (detector && typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      try {
        const codes = await detector.detect(bitmap);
        const hit = codes.find((c) => c.rawValue);
        if (hit?.rawValue) return hit.rawValue;
      } finally {
        bitmap.close?.();
      }
    }
    const reader = await loadZxing();
    const result = await reader.decodeFromImageUrl(url);
    return result?.getText() || null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function openBarcodeScannerModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal barcode-scanner-modal';
    overlay.innerHTML = `
      <div class="camera-modal__panel camera-modal__panel--barcode barcode-scanner">
        <h2 class="barcode-title">Scan barcode</h2>
        <p class="barcode-hint" id="barcodeStatus">Point the camera at the barcode on the pack</p>
        <div class="barcode-scanner__stage" id="barcodeStage">
          <video class="camera-modal__video barcode-scanner__video" playsinline autoplay muted></video>
          <div class="barcode-scanner__frame" aria-hidden="true"></div>
          <p class="barcode-scanner__placeholder" id="barcodePlaceholder">Starting camera…</p>
        </div>
        <label class="field full">
          <span>Or type the barcode number</span>
          <input type="text" inputmode="numeric" id="barcodeManual" placeholder="e.g. 5000159407236" autocomplete="off"/>
        </label>
        <input type="file" accept="image/*" id="barcodePhoto" hidden/>
        <div class="camera-modal__actions barcode-scanner__actions">
          <button type="button" class="btn btn-ghost" id="barcodeCancel">Cancel</button>
          <button type="button" class="btn btn-ghost" id="barcodeUpload">Use photo</button>
          <button type="button" class="btn btn-primary" id="barcodeStartCam" hidden>Start camera</button>
          <button type="button" class="btn btn-primary" id="barcodeLookup">Look up</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const video = overlay.querySelector('video');
    const stage = overlay.querySelector('#barcodeStage');
    const status = overlay.querySelector('#barcodeStatus');
    const placeholder = overlay.querySelector('#barcodePlaceholder');
    const photoInput = overlay.querySelector('#barcodePhoto');
    const startBtn = overlay.querySelector('#barcodeStartCam');
    let stream = null;
    let detector = null;
    let scanTimer = null;
    let zxingControls = null;
    let done = false;
    let starting = false;

    function setStatus(msg) {
      if (status) status.textContent = msg;
    }

    function finish(code) {
      if (done) return;
      done = true;
      cleanup();
      resolve(code || null);
    }

    function cleanup() {
      if (scanTimer) clearInterval(scanTimer);
      try { zxingControls?.stop(); } catch { /* ignore */ }
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
      overlay.remove();
      document.body.style.overflow = '';
    }

    overlay.querySelector('#barcodeCancel').addEventListener('click', () => finish(null));

    overlay.querySelector('#barcodeLookup').addEventListener('click', () => {
      const code = overlay.querySelector('#barcodeManual').value.trim();
      if (code) finish(code);
    });

    overlay.querySelector('#barcodeManual').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = e.target.value.trim();
        if (code) finish(code);
      }
    });

    overlay.querySelector('#barcodeUpload').addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      setStatus('Reading barcode from photo…');
      try {
        const code = await decodeImageFile(file);
        if (code) {
          finish(code);
          return;
        }
        setStatus('Could not read that photo. Try a closer shot, or type the number.');
      } catch {
        setStatus('Could not read that photo. Try a closer shot, or type the number.');
      }
    });

    function startNativeScan(activeDetector) {
      detector = activeDetector;
      if (!detector || !video) return;
      scanTimer = setInterval(async () => {
        if (!video.videoWidth || done) return;
        try {
          const codes = await detector.detect(video);
          const hit = codes.find((c) => c.rawValue);
          if (hit?.rawValue) finish(hit.rawValue);
        } catch {
          /* keep scanning */
        }
      }, 350);
    }

    async function startZxingScan() {
      if (!video || done) return;
      try {
        const reader = await loadZxing();
        if (done) return;
        // Scan the video we already opened. Do not use decodeFromStream —
        // it stops the tracks when it finishes or errors.
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result?.getText()) finish(result.getText());
        });
      } catch {
        setStatus('Live scan unavailable. Type the number or upload a photo.');
      }
    }

    async function startDecoding() {
      const native = nativeDetector();
      if (native) {
        startNativeScan(native);
        return;
      }
      await startZxingScan();
    }

    async function startCamera() {
      if (done || stream || starting) return;
      starting = true;
      startBtn.hidden = true;
      stage?.classList.remove('is-unavailable');
      if (placeholder) placeholder.textContent = 'Starting camera…';
      setStatus('Point the camera at the barcode on the pack');
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
          audio: false,
        });
        if (done) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        // Keep the video in layout before play() so Safari/iOS can produce frames.
        stage?.classList.add('is-live');
        try { await video.play(); } catch { /* autoplay may already be running */ }
        setStatus('Hold the barcode inside the box');
        await startDecoding();
      } catch (err) {
        stage?.classList.add('is-unavailable');
        if (placeholder) placeholder.textContent = 'Camera not available';
        startBtn.hidden = false;
        startBtn.textContent = 'Start camera';
        setStatus(cameraErrorMessage(err));
      } finally {
        starting = false;
      }
    }

    startBtn.addEventListener('click', () => {
      startCamera();
    });

    if (!canUseBarcodeCamera() || !video) {
      stage?.classList.add('is-unavailable');
      if (placeholder) placeholder.textContent = 'Type the number or upload a photo of the barcode.';
      setStatus(cameraErrorMessage({ name: window.isSecureContext ? 'NotFoundError' : 'Insecure' }));
      return;
    }

    startCamera();
  });
}
