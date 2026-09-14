import {
  analyzeFoodPhoto,
  compressImage,
  compressDataUrl,
  needsClarification,
  demoAnalysis,
} from '../services/ai-analysis.js';
import { openMealReviewModal } from '../services/meal-review-modal.js';
import { saveMeal, todayKey } from '../services/storage.js';
import { captureMealPhoto, pickMealPhotoFromGallery, isNativeApp } from '../services/camera.js';
import { canUseWebCamera, openWebCameraModal } from '../services/web-camera.js';
import { canScan, recordScan, scansLabel, paywallMessage } from '../services/subscription.js';
import { isSupabaseConfigured } from '../services/auth.js';
import { defaultMealType, inferMealTypeFromText, mealTypeLabel } from '../services/meal-types.js';
import { lookupBarcodeProduct } from '../services/barcode.js';
import { barcodeFieldForMeal, isPackagedLogSource } from '../services/packaged-log.js';
import { openPackagedLogWizard } from '../services/packaged-log-wizard.js';
import { openBarcodeScannerModal } from '../services/barcode-scanner.js';
import { lookupFoodProduct } from '../services/food-search.js';
import { openFoodSearchModal } from '../services/food-search-modal.js';
import { DISCLAIMERS, disclaimerBlock } from '../services/disclaimers.js';
import { requireAiProcessingConsent } from '../services/privacy-consent.js';
import {
  photoScanAnalyzingHtml,
  packagedLookupAnalyzingHtml,
  startPhotoScanStatusCycle,
  PHOTO_ANALYSIS_STEPS,
} from '../services/analyze-scan-ui.js';
import {
  normalizeClarificationQuestions,
  getClarificationStepConfig,
} from '../services/clarification-questions.js';
import { finalizeClarificationAnswers } from '../../shared/clarification-apply.js';
import {
  buildPhotoAnalysisNotes,
  formatDrinkMealNotes,
  inferMealTypeForDrink,
  analysisIsMainlyDrink,
  inferDrinkSubtypeFromAnalysis,
} from '../services/drink-logging.js';
import {
  attachSpeechInput,
  isSpeechInputSupported,
  speechInputUnavailableMessage,
  stopSpeechInput,
} from '../services/speech-input.js';
import { estimateMealFromDescription } from '../services/voice-quick-log.js';
import { takePendingLogRouting, setLogSessionStep } from './log-routing.js';
import { getLogTargetDate } from './app-nav-state.js';
import {
  PHOTO_ACCEPT,
  validatePhotoFile,
  cameraErrorMessage,
  assessPhotoQuality,
} from '../services/photo-quality.js';
import { roundDisplay, formatNutrientLine } from '../services/eaten-amount.js';
import { hasUsefulFoodItems } from '../../shared/analysis-result.js';
import { scoreMealConfidence } from '../../shared/nutrition-confidence.js';
import { enrichAnalysisWithUserNotes } from '../../shared/user-notes-apply.js';

/** Keeps photo flow alive if the screen re-renders mid-upload */
let activeLogState = null;
let analyzeStatusCleanup = null;
let speechInputCleanup = null;

function speechMicButton(id, labelIdle = 'Speak your answer') {
  const supported = isSpeechInputSupported();
  const title = supported
    ? 'Tap to speak · tap again to stop'
    : speechInputUnavailableMessage();
  return `
    <button
      type="button"
      class="speech-mic-btn${supported ? '' : ' speech-mic-btn--unsupported'}"
      id="${id}"
      data-label-idle="${escapeAttr(labelIdle)}"
      aria-label="${escapeAttr(labelIdle)}"
      aria-pressed="false"
      title="${escapeAttr(title)}"
    >
      <span class="speech-mic-btn__icon" aria-hidden="true">🎤</span>
      <span class="speech-mic-btn__text">Speak</span>
    </button>
  `;
}

function speechHintHtml() {
  if (isSpeechInputSupported()) {
    return '<p class="speech-field-hint fine-print">Voice is turned into text on your device — check it before continuing.</p>';
  }
  return `<p class="speech-field-hint fine-print">${escapeHtml(speechInputUnavailableMessage())}</p>`;
}

export function isLogBusy() {
  return ['analyzing', 'clarify', 'review', 'confirm', 'saving'].includes(activeLogState?.step);
}

export function renderLog(root, { onSaved, onCancel, showToast, onUpgrade, profile, onSignIn }) {
  const routing = takePendingLogRouting();
  const initialStep = routing.photoOnly ? 'photo' : routing.barcodeOnly ? 'barcode_redirect' : routing.describeOnly ? 'describe' : routing.focus === 'search' ? 'search_redirect' : 'method';
  let analysisAbort = null;
  let state = activeLogState || {
    step: initialStep,
    image: null,
    analysis: null,
    answers: [],
    scanRecorded: false,
    status: '',
    mealType: routing.mealType || defaultMealType(),
    mealTypeLocked: Boolean(routing.mealType),
    mealNotes: '',
    mainlyDrink: false,
    source: null,
    completeness: null,
    mealWeightGrams: null,
    photoQuality: null,
    analysisId: null,
    saveId: null,
    analyzing: false,
    saving: false,
    slowHint: false,
    openGalleryOnMount: routing.focus === 'upload',
    describeText: '',
  };

  function persist() {
    activeLogState = state;
    setLogSessionStep(state.step);
  }

  function clearSession() {
    if (analyzeStatusCleanup) {
      analyzeStatusCleanup();
      analyzeStatusCleanup = null;
    }
    speechInputCleanup?.();
    speechInputCleanup = null;
    stopSpeechInput();
    activeLogState = null;
    setLogSessionStep(null);
  }

  function bindSpeechField(inputSelector, buttonSelector, { append = false } = {}) {
    speechInputCleanup?.();
    speechInputCleanup = null;
    stopSpeechInput();
    const input = root.querySelector(inputSelector);
    const button = root.querySelector(buttonSelector);
    if (!input || !button) return;
    speechInputCleanup = attachSpeechInput({
      input,
      button,
      append,
      onMessage: (msg) => showToast(msg, 4500),
    });
  }

  function setStatus(msg) {
    state.status = msg;
    if (msg) showToast(msg, 4500);
  }

  function readNotesFromDom() {
    const el = root.querySelector('#photoNotesInput');
    if (el) state.mealNotes = el.value.trim();
  }

  function effectiveAnalysisNotes() {
    return buildPhotoAnalysisNotes(state.mealNotes);
  }

  function enrichDrinkContext(analysis) {
    if (!analysisIsMainlyDrink(analysis)) {
      state.mainlyDrink = false;
      return;
    }
    state.mainlyDrink = true;
    analysis._drinkLogSubtype = inferDrinkSubtypeFromAnalysis(analysis);
    if (!state.mealTypeLocked) {
      state.mealType = inferMealTypeForDrink(analysis._drinkLogSubtype);
    }
  }

  function clearPhotoFlow() {
    state.source = null;
    state.mainlyDrink = false;
  }

  function preparePhotoFlow() {
    state.source = 'photo';
    state.mainlyDrink = false;
    readNotesFromDom();
    const fromNotes = inferMealTypeFromText(state.mealNotes);
    if (fromNotes) {
      state.mealType = fromNotes;
      state.mealTypeLocked = true;
    } else if (!state.mealTypeLocked) {
      state.mealType = defaultMealType();
    }
  }

  function photoPaywallTitle(budget = canScan()) {
    if (budget.reason === 'daily_limit') return 'No scans left today';
    return 'Need more scans?';
  }

  function photoControlsHtml({ cameraHint, tipText, needsSignIn, photoBlocked, native, liveCamera, needsHttpsHint }) {

    if (needsSignIn) {
      return `
        <section class="login-banner">
          <p><strong>Sign in required</strong> for photo and packaged-food logging when cloud sync is enabled.</p>
          <button type="button" class="btn btn-primary btn-sm" id="logSignInBtn">Sign in</button>
        </section>
      `;
    }
    if (photoBlocked) {
      const budget = canScan();
      return `
        <div class="paywall-inline paywall-inline--prominent">
          <p class="paywall-inline__title">${photoPaywallTitle(budget)}</p>
          <p>${escapeHtml(paywallMessage(budget))}</p>
          <button type="button" class="btn btn-primary full" id="upgradeBtn">Top up credits</button>
        </div>
      `;
    }
    return `
      ${native ? `
        <button type="button" class="camera-zone" id="cameraZone">
          <span class="camera-icon">📷</span>
          <span class="camera-text">Take photo</span>
          <span class="camera-hint">${escapeHtml(cameraHint)}</span>
        </button>
        <button type="button" class="btn btn-ghost full" id="galleryBtn">Choose from gallery</button>
      ` : `
        ${liveCamera ? `
          <button type="button" class="camera-zone" id="liveCameraBtn">
            <span class="camera-icon">📷</span>
            <span class="camera-text">Open camera</span>
            <span class="camera-hint">${escapeHtml(cameraHint)}</span>
          </button>
        ` : `
          <div class="picker-wrap camera-zone">
            <input type="file" accept="${PHOTO_ACCEPT}" capture="environment" id="photoInput" class="picker-overlay" aria-label="Take photo"/>
            <div class="picker-label">
              <span class="camera-icon">📷</span>
              <span class="camera-text">Take photo</span>
              <span class="camera-hint">${escapeHtml(cameraHint)}</span>
            </div>
          </div>
        `}
        <input type="file" accept="${PHOTO_ACCEPT}" id="galleryInput" class="file-input-offscreen" aria-hidden="true" tabindex="-1"/>
        <button type="button" class="btn btn-ghost full" id="galleryBtn">Choose from gallery or device</button>
        <div class="photo-drop" id="photoDrop" tabindex="0">Drop a photo here (JPEG, PNG, WebP or HEIC)</div>
        ${needsHttpsHint ? `<p class="fine-print warn-text log-section__warn">${import.meta.env.DEV ? `For phone camera: open <strong>https://${window.location.host}</strong> (not http). Gallery upload works on both.` : 'For phone camera on mobile, open NutriLog over a secure (HTTPS) connection. Gallery upload works either way.'}</p>` : ''}
      `}
      ${tipText ? `<p class="fine-print log-section__tip">${tipText}</p>` : ''}
    `;
  }

  function bindPhotoControls() {
    root.querySelector('#cameraZone')?.addEventListener('click', openCamera);
    root.querySelector('#liveCameraBtn')?.addEventListener('click', openLiveCamera);
    root.querySelector('#photoInput')?.addEventListener('change', onPhotoSelected);
    const galleryInput = root.querySelector('#galleryInput');
    const galleryBtn = root.querySelector('#galleryBtn');
    if (galleryInput && galleryBtn) {
      galleryBtn.addEventListener('click', () => {
        galleryInput.value = '';
        galleryInput.click();
      });
      galleryInput.addEventListener('change', onPhotoSelected);
    } else if (galleryBtn) {
      galleryBtn.addEventListener('click', openGallery);
    }
    const drop = root.querySelector('#photoDrop');
    if (drop) {
      drop.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('is-over');
      });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('is-over');
        const file = e.dataTransfer?.files?.[0];
        if (file) onPhotoFile(file);
      });
    }
  }

  function logProgress(current) {
    const order = ['method', 'photo', 'analyzing', 'clarify', 'review', 'confirm'];
    const labels = {
      method: 'Choose method',
      photo: 'Select photo',
      analyzing: 'Analyse',
      failed: 'Try again',
      clarify: 'Quick questions',
      review: 'Review foods',
      confirm: 'Save',
      describe: 'Describe meal',
    };
    const idx = Math.max(1, order.indexOf(current) + 1);
    return `<p class="log-progress" aria-live="polite"><span aria-current="step">${escapeHtml(labels[current] || current)}</span> · Step ${idx} of ${order.length}</p>`;
  }

  function renderCapture() {
    const scan = canScan();
    const native = isNativeApp();
    const liveCamera = !native && canUseWebCamera();
    const needsHttpsHint = !native && !window.isSecureContext;
    const needsSignIn = isSupabaseConfigured() && !profile?.loggedIn;
    const photoBlocked = false;
    const photoOpts = { needsSignIn, photoBlocked, native, liveCamera, needsHttpsHint };

    root.innerHTML = `
      <section class="log-screen">
        <button type="button" class="back-link" id="cancelLog">← Back</button>
        ${logProgress('photo')}
        <h2>Take or upload a photo</h2>
        <p class="log-screen__lead">Photograph the whole meal, or choose a picture from this device. Credits are only used after a successful analysis.</p>

        <section class="log-section log-section--photo" aria-labelledby="logPhotoHeading">
          <header class="log-section__head">
            <h3 class="log-section__title" id="logPhotoHeading">Your photo</h3>
            <p class="log-section__desc">Works for plates, cups and glasses. Barcode, describe and food search are on the previous screen and stay free.</p>
          </header>
          ${!needsSignIn ? `<p class="scan-badge ${scan.allowed ? '' : 'scan-badge--limit'}">${scansLabel()}</p>` : ''}
          <label class="field full meal-hints-field">
            <span>Notes <em class="optional-tag">optional</em></span>
            <div class="speech-field">
              <textarea id="photoNotesInput" rows="2" maxlength="280" placeholder="Add anything the photo may not show — e.g. &quot;half portion&quot;, &quot;oat latte no sugar&quot;, &quot;diet cola&quot;">${escapeHtml(state.mealNotes)}</textarea>
              ${speechMicButton('photoNotesMic', 'Speak meal notes')}
            </div>
            ${speechHintHtml()}
          </label>
          ${photoControlsHtml({
            ...photoOpts,
            cameraHint: 'Include the full plate, cup, or glass',
            tipText: 'Tip: good lighting helps. We ask follow-up questions only when needed.',
          })}
          ${disclaimerBlock(DISCLAIMERS.aiPhoto, 'fine-print health-disclaimer log-section__disclaimer')}
        </section>

        ${state.status ? `<p class="log-status" id="logStatus" aria-live="polite">${escapeHtml(state.status)}</p>` : ''}
      </section>
    `;

    root.querySelector('#cancelLog')?.addEventListener('click', () => {
      state.step = 'method';
      persist();
      render();
    });
    root.querySelector('#logSignInBtn')?.addEventListener('click', () => onSignIn?.());
    bindPhotoControls();
    root.querySelectorAll('#upgradeBtn').forEach((btn) => btn.addEventListener('click', () => onUpgrade?.()));
    bindSpeechField('#photoNotesInput', '#photoNotesMic', { append: true });
    if (state.openGalleryOnMount) {
      state.openGalleryOnMount = false;
      root.querySelector('#galleryBtn')?.click();
    }
  }

  function render() {
    if (state.step !== 'analyzing' && analyzeStatusCleanup) {
      analyzeStatusCleanup();
      analyzeStatusCleanup = null;
    }
    if (state.step === 'method') setLogSessionStep(null);
    else persist();
    if (state.step === 'barcode_redirect') {
      state.step = 'method';
      persist();
      renderMethod();
      openBarcode();
      return;
    }
    if (state.step === 'search_redirect') {
      state.step = 'method';
      persist();
      renderMethod();
      openFoodSearch();
      return;
    }
    if (state.step === 'method') renderMethod();
    else if (state.step === 'describe') renderDescribe();
    else if (state.step === 'photo' || state.step === 'capture') renderCapture();
    else if (state.step === 'preview' || state.step === 'weight') {
      if (state.image) startAnalysis();
      else renderCapture();
    }
    else if (state.step === 'paywall') renderPaywall();
    else if (state.step === 'failed') renderFailed();
    else if (state.step === 'analyzing') renderAnalyzing();
    else if (state.step === 'clarify') renderClarify();
    else if (state.step === 'confirm') renderConfirm();
    else if (state.step === 'review') showReviewFlow();
  }

  function renderMethod() {
    root.innerHTML = `
      <section class="log-screen log-method">
        <button type="button" class="back-link" id="cancelLog">← Back</button>
        ${logProgress('method')}
        <h2>How would you like to log your meal?</h2>
        <p class="log-screen__lead">Pick one way in. You can always go back and choose another.</p>
        <div class="log-method__list">
          <button type="button" class="log-method__card" data-method="photo">
            <strong>Take a photo</strong>
            <span>Photograph your meal now.</span>
          </button>
          <button type="button" class="log-method__card" data-method="upload">
            <strong>Upload a photo</strong>
            <span>Choose an existing image from your phone, tablet or computer.</span>
          </button>
          <button type="button" class="log-method__card" data-method="barcode">
            <strong>Scan barcode</strong>
            <span>For packaged food. <em>Free — no photo-scan credits.</em></span>
          </button>
          <button type="button" class="log-method__card" data-method="describe">
            <strong>Describe meal</strong>
            <span>Type or dictate what you ate. <em>Free — no photo-scan credits.</em></span>
          </button>
          <button type="button" class="log-method__card" data-method="search">
            <strong>Search foods</strong>
            <span>Find foods and build the meal manually. <em>Free — no photo-scan credits.</em></span>
          </button>
        </div>
      </section>
    `;
    root.querySelector('#cancelLog')?.addEventListener('click', () => { clearSession(); onCancel(); });
    root.querySelectorAll('[data-method]').forEach((btn) => {
      btn.addEventListener('click', () => chooseMethod(btn.dataset.method));
    });
  }

  function chooseMethod(method) {
    if (method === 'photo') {
      state.step = 'photo';
      persist();
      render();
      return;
    }
    if (method === 'upload') {
      state.step = 'photo';
      state.openGalleryOnMount = true;
      persist();
      render();
      return;
    }
    if (method === 'barcode') {
      openBarcode();
      return;
    }
    if (method === 'search') {
      openFoodSearch();
      return;
    }
    if (method === 'describe') {
      state.step = 'describe';
      persist();
      render();
    }
  }

  function renderDescribe() {
    root.innerHTML = `
      <section class="log-screen">
        <button type="button" class="back-link" id="backMethod">← Back</button>
        <h2>Describe your meal</h2>
        <p class="log-screen__lead">Type or dictate what you ate. This is free and does not use photo-scan credits.</p>
        <label class="field full">
          <span>Meal description</span>
          <div class="speech-field">
            <textarea id="describeInput" rows="4" maxlength="500" placeholder="e.g. 3 medium idlis, sambar and coconut chutney">${escapeHtml(state.describeText || '')}</textarea>
            ${speechMicButton('describeMic', 'Speak your meal')}
          </div>
          ${speechHintHtml()}
        </label>
        <button type="button" class="btn btn-primary full" id="describeContinue">Review estimate</button>
        ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer')}
      </section>
    `;
    root.querySelector('#backMethod')?.addEventListener('click', () => {
      state.describeText = root.querySelector('#describeInput')?.value || '';
      state.step = 'method';
      persist();
      render();
    });
    root.querySelector('#describeContinue')?.addEventListener('click', () => {
      const text = root.querySelector('#describeInput')?.value.trim() || '';
      state.describeText = text;
      const analysis = estimateMealFromDescription(text);
      if (!analysis?.items?.length) {
        showToast('Add a little more detail — for example foods and amounts.');
        return;
      }
      state.analysis = analysis;
      state.source = 'describe';
      state.step = 'review';
      persist();
      render();
    });
    bindSpeechField('#describeInput', '#describeMic', { append: true });
  }

  async function openBarcode() {
    if (isSupabaseConfigured() && !profile?.loggedIn) {
      showToast('Sign in for free barcode logging', 4500);
      onSignIn?.();
      return;
    }
    readNotesFromDom();
    try {
      const code = await openBarcodeScannerModal();
      if (!code) return;
      await lookupPackagedFood(code, 'barcode');
    } catch (err) {
      showToast(err.message || 'Barcode lookup failed');
      state.step = 'method';
      state.source = null;
      persist();
      render();
    }
  }

  async function openFoodSearch() {
    if (isSupabaseConfigured() && !profile?.loggedIn) {
      showToast('Sign in for free barcode logging', 4500);
      onSignIn?.();
      return;
    }
    readNotesFromDom();
    try {
      const code = await openFoodSearchModal();
      if (!code) return;
      await lookupPackagedFood(code, 'food_search');
    } catch (err) {
      showToast(err.message || 'Food lookup failed');
      state.step = 'method';
      state.source = null;
      persist();
      render();
    }
  }

  async function lookupPackagedFood(code, source) {
    state.step = 'analyzing';
    state.status = source === 'food_search' ? 'Looking up food…' : 'Looking up product…';
    state.source = source;
    persist();
    render();
    const product = source === 'food_search' ? await lookupFoodProduct(code) : await lookupBarcodeProduct(code);
    state.analysis = product;
    state.image = product.imageUrl
      ? { dataUrl: product.imageUrl, base64: null, mimeType: 'image/jpeg', external: true }
      : null;
    state.step = 'review';
    state.status = '';
    persist();
    render();
  }

  async function openLiveCamera() {
    preparePhotoFlow();
    try {
      const img = await openWebCameraModal();
      if (img) await useImage(img);
    } catch (err) {
      const info = cameraErrorMessage(err);
      showToast(info.message);
      if (info.offerUpload) root.querySelector('#galleryBtn')?.click();
    }
  }

  function renderPaywall() {
    const scan = canScan();
    root.innerHTML = `
      <section class="log-screen center">
        <h2>${photoPaywallTitle(scan)}</h2>
        <p class="lead">${escapeHtml(paywallMessage(scan))}</p>
        <button type="button" class="btn btn-primary full" id="upgradeBtn">Top up credits</button>
        <button type="button" class="btn btn-ghost full" id="backCapture">Back</button>
      </section>
    `;
    root.querySelector('#upgradeBtn').addEventListener('click', () => onUpgrade?.());
    root.querySelector('#backCapture').addEventListener('click', () => {
      state.step = 'photo';
      clearPhotoFlow();
      render();
    });
  }

  async function openCamera() {
    preparePhotoFlow();
    try {
      const native = await captureMealPhoto();
      if (native) await useImage(native);
    } catch (err) {
      const info = cameraErrorMessage(err);
      showToast(info.message);
      if (info.offerUpload) root.querySelector('#galleryBtn')?.click();
    }
  }

  async function openGallery() {
    preparePhotoFlow();
    try {
      const img = await pickMealPhotoFromGallery();
      if (img) await useImage(img);
    } catch (err) {
      showToast(err.message || 'Could not open gallery');
    }
  }

  async function onPhotoFile(file) {
    preparePhotoFlow();
    const check = validatePhotoFile(file);
    if (!check.ok) {
      setStatus(check.message);
      return;
    }
    state.status = `Reading ${file.name || 'photo'}…`;
    persist();
    try {
      const compressed = await compressImage(file);
      if (!compressed?.base64) throw new Error('Photo was empty — try another image');
      await useImage(compressed);
    } catch (err) {
      state.status = err.message || 'Could not read photo — try JPG or PNG';
      state.step = 'photo';
      persist();
      render();
      showToast(state.status, 5000);
    }
  }

  async function onPhotoSelected(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    await onPhotoFile(file);
  }

  async function useImage(image) {
    if (isSupabaseConfigured() && !profile?.loggedIn) {
      showToast('Sign in to log meals with AI', 4500);
      onSignIn?.();
      return;
    }
    const aiOk = await requireAiProcessingConsent();
    if (!aiOk) {
      showToast('AI photo logging needs your consent — try packaged food search instead', 5000);
      return;
    }
    readNotesFromDom();
    try {
      if (image?.dataUrl && !image.external) {
        try {
          image = await compressDataUrl(image.dataUrl, image.mimeType);
        } catch (_) {
          /* use original if compression fails */
        }
      }
      state.image = image;
      state.status = '';
      try {
        state.photoQuality = await assessPhotoQuality(image?.dataUrl);
      } catch (_) {
        state.photoQuality = null;
      }
      persist();
      startAnalysis();
    } catch (err) {
      setStatus(err.message || 'Something went wrong — try again');
      state.step = 'capture';
      persist();
      render();
    }
  }

  function startAnalysis() {
    if (state.analyzing) return;
    if (!canScan().allowed) {
      state.step = 'paywall';
      persist();
      render();
      return;
    }
    state.analyzing = true;
    state.cancelled = false;
    state.analysisId = state.analysisId || (crypto.randomUUID?.() || `an-${Date.now()}`);
    state.step = 'analyzing';
    persist();
    render();
    runAnalysis();
  }

  function renderConfirm() {
    const a = state.analysis || {};
    const items = a.items || [];
    const unmatched = items.filter((i) => i._unmatched).length;
    const nutrients = formatNutrientLine(a.total_nutrition || {});
    const low = a._confidence?.band === 'low';
    root.innerHTML = `
      <section class="log-screen log-confirm">
        <button type="button" class="back-link" id="backReview">← Review portions</button>
        ${logProgress('confirm')}
        <h2>Does everything look right?</h2>
        <ul class="log-confirm__facts">
          <li><strong>${escapeHtml(a.meal_summary || 'Meal')}</strong></li>
          <li>${escapeHtml(mealTypeLabel(state.mealType) || state.mealType)} · ${escapeHtml(getLogTargetDate() || todayKey())}</li>
          <li>${items.length} foods · ${roundDisplay(a._consumedGrams || 0)} g eaten</li>
          <li>Estimated ${Math.round(a.total_calories_kcal || 0)} kcal${a._confidence?.kcalRange ? ` · likely ${a._confidence.kcalRange.min}–${a._confidence.kcalRange.max} kcal` : ''}</li>
          ${a._confidence ? `<li>${escapeHtml(a._confidence.band)} confidence${a._confidence.primaryUncertainty ? ` · ${escapeHtml(a._confidence.primaryUncertainty)}` : ''}</li>` : ''}
          ${nutrients.line ? `<li>${escapeHtml(nutrients.line)}</li>` : ''}
          ${nutrients.notes ? `<li>${escapeHtml(nutrients.notes)}</li>` : ''}
          ${unmatched ? `<li class="warn-text">${unmatched} food${unmatched === 1 ? '' : 's'} still need a nutrition match</li>` : ''}
          ${low ? '<li class="warn-text">Low confidence — you can still save. The uncertainty reason is kept with this meal.</li>' : ''}
        </ul>
        <button type="button" class="btn btn-primary full" id="saveMealBtn">Save meal</button>
        <button type="button" class="btn btn-ghost full" id="backReviewBtn">Review portions</button>
        <button type="button" class="btn btn-ghost full" id="changeFoodBtn">Change a food</button>
        <button type="button" class="btn btn-ghost full" id="addMissingBtn">Add missing food</button>
        <button type="button" class="btn btn-ghost full" id="anotherPhotoBtn">Analyse another photo</button>
        <button type="button" class="btn btn-ghost full" id="cancelConfirm">Cancel</button>
      </section>
    `;
    const goReview = () => { state.step = 'review'; persist(); render(); };
    root.querySelector('#backReview')?.addEventListener('click', goReview);
    root.querySelector('#backReviewBtn')?.addEventListener('click', goReview);
    root.querySelector('#saveMealBtn')?.addEventListener('click', () => commitMealSave());
    root.querySelector('#changeFoodBtn')?.addEventListener('click', goReview);
    root.querySelector('#addMissingBtn')?.addEventListener('click', goReview);
    root.querySelector('#anotherPhotoBtn')?.addEventListener('click', () => {
      state.image = null;
      state.analysis = null;
      state.scanRecorded = false;
      state.analysisId = null;
      state.step = 'photo';
      persist();
      render();
    });
    root.querySelector('#cancelConfirm')?.addEventListener('click', () => { clearSession(); onCancel(); });
  }

  async function runAnalysis() {
    const notes = effectiveAnalysisNotes();
    const requestId = state.analysisId;
    state.cancelled = false;
    analysisAbort?.abort();
    analysisAbort = new AbortController();
    try {
      const analysis = await analyzeFoodPhoto(
        state.image.base64,
        state.image.mimeType,
        notes,
        { idempotencyKey: requestId, signal: analysisAbort.signal },
      );
      if (state.cancelled || state.analysisId !== requestId) return;
      if (!hasUsefulFoodItems(analysis)) {
        state.analyzing = false;
        state.status = 'No food was found in that photo. No scan credit was used.';
        state.step = 'failed';
        persist();
        render();
        showToast(state.status, 6000);
        return;
      }
      let next = analysis;
      next._photoQualityPoor = Boolean(state.photoQuality?.reduceConfidence);
      next.source = 'photo';
      next._userDescription = state.mealNotes || '';
      next = enrichAnalysisWithUserNotes(next, state.mealNotes);
      const fromNotes = inferMealTypeFromText(state.mealNotes);
      if (fromNotes) {
        state.mealType = fromNotes;
        state.mealTypeLocked = true;
      }
      state.analysis = next;
      enrichDrinkContext(state.analysis);
      if (!isSupabaseConfigured() && !state.scanRecorded) {
        recordScan();
        state.scanRecorded = true;
      }
      state.status = '';
    } catch (err) {
      state.analyzing = false;
      if (state.cancelled || err?.name === 'AbortError') {
        state.step = 'photo';
        persist();
        render();
        return;
      }
      if (err?.requiresAuth) {
        showToast('Sign in to log meals with AI', 5000);
        onSignIn?.();
        state.step = 'photo';
        persist();
        render();
        return;
      }
      if (err?.limitReached) {
        state.step = 'paywall';
        persist();
        render();
        showToast(err.message, 5000);
        return;
      }
      const needsKey = /GEMINI|OPENAI|503|not configured/i.test(err.message || '');
      if (needsKey && !import.meta.env.PROD) {
        state.analysis = { ...demoAnalysis(), demoEstimate: true };
        enrichDrinkContext(state.analysis);
        state.status = 'Sample estimate only — connect AI for your actual photo';
      } else {
        const msg = needsKey
          ? 'Photo logging is temporarily unavailable. Try Describe or Search foods instead.'
          : friendlyAnalysisError(err.message);
        state.status = msg;
        state.step = 'failed';
        persist();
        render();
        showToast(msg, 6000);
        return;
      }
    }
    state.analyzing = false;
    if (needsClarification(state.analysis, 0.72, state.mealNotes)) {
      state.clarificationSteps = normalizeClarificationQuestions(state.analysis, state.mealNotes);
      state.step = 'clarify';
      state.answers = [];
    } else {
      state.step = 'review';
    }
    persist();
    render();
  }

  function renderFailed() {
    root.innerHTML = `
      <section class="log-screen">
        <button type="button" class="back-link" id="backPreview">← Back</button>
        ${logProgress('failed')}
        <h2>We could not finish this analysis</h2>
        <p class="log-screen__lead">${escapeHtml(state.status || 'Something went wrong. Your photo and notes are still here.')}</p>
        ${state.image?.dataUrl ? `<img src="${state.image.dataUrl}" alt="Selected meal photo" class="preview-img"/>` : ''}
        <button type="button" class="btn btn-primary full" id="retryAnalysis">Try again</button>
        <button type="button" class="btn btn-ghost full" id="failDescribe">Describe the meal</button>
        <button type="button" class="btn btn-ghost full" id="failSearch">Search foods manually</button>
        <button type="button" class="btn btn-ghost full" id="failPhoto">Choose another photo</button>
      </section>
    `;
    root.querySelector('#backPreview')?.addEventListener('click', () => { state.step = 'photo'; persist(); render(); });
    root.querySelector('#retryAnalysis')?.addEventListener('click', () => startAnalysis());
    root.querySelector('#failDescribe')?.addEventListener('click', () => { state.step = 'describe'; persist(); render(); });
    root.querySelector('#failSearch')?.addEventListener('click', () => openFoodSearch());
    root.querySelector('#failPhoto')?.addEventListener('click', () => {
      state.analysisId = null;
      state.scanRecorded = false;
      state.step = 'photo';
      persist();
      render();
    });
  }

  function renderAnalyzing() {
    if (analyzeStatusCleanup) {
      analyzeStatusCleanup();
      analyzeStatusCleanup = null;
    }

    const isLookup = state.source === 'barcode' || state.source === 'food_search';
    const scanPanel = isLookup
      ? packagedLookupAnalyzingHtml(state.image?.dataUrl, {
          title: 'Looking up food…',
          subtitle: 'Fetching nutrition from product database…',
        })
      : photoScanAnalyzingHtml(state.image?.dataUrl);

    root.innerHTML = `
      <section class="log-screen log-screen--analyzing ${isLookup ? 'center' : ''}">
        ${logProgress('analyzing')}
        ${scanPanel}
        ${!isLookup ? `<p class="fine-print" id="analysisSlowHint" hidden>This meal is taking a little longer to analyse.</p>` : ''}
        ${!isLookup ? `<button type="button" class="btn btn-ghost full" id="cancelAnalysis">Cancel</button>` : ''}
        ${!isLookup ? disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer meal-scan__disclaimer') : ''}
      </section>
    `;

    if (!isLookup) {
      analyzeStatusCleanup = startPhotoScanStatusCycle(root, PHOTO_ANALYSIS_STEPS);
      window.setTimeout(() => {
        const hint = root.querySelector('#analysisSlowHint');
        if (hint && state.step === 'analyzing') hint.hidden = false;
      }, 8000);
      root.querySelector('#cancelAnalysis')?.addEventListener('click', () => {
        state.cancelled = true;
        state.analyzing = false;
        analysisAbort?.abort();
        state.step = 'photo';
        persist();
        render();
      });
    }
  }

  function renderClarify() {
    const steps = state.clarificationSteps?.length
      ? state.clarificationSteps
      : normalizeClarificationQuestions(state.analysis, state.mealNotes);
    const current = state.answers.length;
    const step = steps[current];
    if (!step) {
      goToReviewFromClarify();
      return;
    }
    const ui = getClarificationStepConfig(step, state.analysis);
    const total = steps.length;

    const optionHtml = ui.multi
      ? ui.options.map((o) => `<label class="option-check"><input type="checkbox" data-answer="${escapeAttr(o)}"/> ${escapeHtml(o)}</label>`).join('')
      : ui.options.map((o) => `<button type="button" class="option-btn" data-answer="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join('');

    root.innerHTML = `
      <section class="log-screen log-screen--clarify">
        ${logProgress('clarify')}
        ${state.image?.dataUrl ? `<img src="${state.image.dataUrl}" alt="" class="preview-img preview-img--small"/>` : ''}
        <p class="step-label">Quick question ${current + 1} of ${total}</p>
        <h2 class="clarify-question">${escapeHtml(ui.question)}</h2>
        <p class="clarify-helper">${escapeHtml(ui.helper)}</p>
        <div class="option-grid" id="optionGrid">
          ${optionHtml}
        </div>
        <label class="field">
          <span>${escapeHtml(ui.inputLabel)}</span>
          <div class="speech-field">
            <input type="text" id="customAnswer" inputmode="${escapeAttr(ui.inputMode)}" placeholder="${escapeAttr(ui.inputPlaceholder)}"/>
            ${speechMicButton('customAnswerMic', 'Speak your answer')}
          </div>
          ${speechHintHtml()}
        </label>
        <button type="button" class="btn btn-primary full" id="submitAnswer">Continue</button>
        <button type="button" class="btn btn-ghost full" id="skipClarify">Skip and review meal</button>
        ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer')}
      </section>
    `;

    if (ui.multi) {
      root.querySelector('#submitAnswer').addEventListener('click', () => {
        const custom = root.querySelector('#customAnswer').value.trim();
        const selected = [...root.querySelectorAll('#optionGrid input:checked')].map((el) => el.dataset.answer);
        if (custom) selected.push(custom);
        if (!selected.length) {
          showToast('Pick at least one option, or Skip and review meal');
          return;
        }
        submitAnswer(selected.join(', '));
      });
    } else {
      root.querySelectorAll('.option-btn').forEach((btn) => {
        btn.addEventListener('click', () => submitAnswer(btn.dataset.answer));
      });
      root.querySelector('#submitAnswer').addEventListener('click', () => {
        const custom = root.querySelector('#customAnswer').value.trim();
        if (custom) submitAnswer(custom);
        else showToast('Pick an option or type an answer');
      });
    }
    root.querySelector('#skipClarify')?.addEventListener('click', () => {
      goToReviewFromClarify();
    });
    bindSpeechField('#customAnswer', '#customAnswerMic', { append: false });
  }

  async function submitAnswer(answer) {
    const steps = state.clarificationSteps?.length
      ? state.clarificationSteps
      : normalizeClarificationQuestions(state.analysis, state.mealNotes);
    const idx = state.answers.length;
    state.answers.push({
      question: steps[idx].question,
      answer,
      topic: steps[idx].topic,
      about: steps[idx].about,
    });
    if (/^not sure$/i.test(String(answer))) {
      state.analysis._notSureAnswers = (state.analysis._notSureAnswers || 0) + 1;
      if (/oil|butter|ghee/i.test(steps[idx].question + steps[idx].topic)) state.analysis._unknownOil = true;
      if (/sauce/i.test(steps[idx].question + steps[idx].topic)) state.analysis._unknownSauce = true;
    }
    if (state.answers.length < steps.length) {
      persist();
      render();
      return;
    }
    goToReviewFromClarify();
  }

  function goToReviewFromClarify() {
    state.analysis = finalizeClarificationAnswers(state.analysis, state.answers);
    enrichDrinkContext(state.analysis);
    state.step = 'review';
    persist();
    render();
  }

  async function showReviewFlow() {
    if (isPackagedLogSource(state.source || state.analysis?.source)) {
      await showPackagedReview();
      return;
    }
    const isDrink = state.mainlyDrink;
    root.innerHTML = `
      <section class="log-screen center">
        ${state.image?.dataUrl ? `<img src="${state.image.dataUrl}" alt="" class="preview-img preview-img--small"/>` : ''}
        <div class="spinner" aria-hidden="true"></div>
        <h2>Review your log</h2>
        <p>${isDrink ? 'Check volume and add anything the camera missed.' : 'Check portions and add anything the camera missed.'}</p>
      </section>
    `;

    const result = await openMealReviewModal(state.analysis, {
      mealType: state.mealType,
      imageDataUrl: state.image?.dataUrl || null,
    });

    if (!result) {
      state.step = 'method';
      persist();
      render();
      return;
    }

    state.analysis = result.analysis;
    state.mealType = result.mealType || state.mealType;
    if (result.mealType) state.mealTypeLocked = true;
    state.step = 'confirm';
    persist();
    render();
  }

  async function showPackagedReview() {
    const result = await openPackagedLogWizard(state.analysis, {
      mealType: state.mealType,
      imageDataUrl: state.image?.dataUrl || null,
    });
    if (!result) {
      state.step = 'method';
      persist();
      render();
      return;
    }
    if (result.retry === 'barcode') {
      await openBarcode();
      return;
    }
    if (result.retry === 'search') {
      await openFoodSearch();
      return;
    }
    state.analysis = result.analysis;
    state.mealType = result.mealType || state.mealType;
    persist();
    await commitMealSave();
  }

  async function commitMealSave() {
    if (state.saving) return;
    const a = state.analysis;
    const items = a?.items || [];
    if (!items.length) {
      showToast('Add at least one food before saving.');
      state.step = 'review';
      persist();
      render();
      return;
    }
    if (items.every((item) => item._unmatched)) {
      showToast('Match at least one food to nutrition data before saving.');
      return;
    }
    if (items.some((item) => Number(item.calories_kcal) < 0 || Number(item.grams) < 0)) {
      showToast('A food has an invalid amount. Check portions before saving.');
      return;
    }
    if (items.some((item) => !(Number(item._originalGrams ?? item.grams) > 0) && !item._unmatched)) {
      showToast('A required serving is missing.');
      return;
    }
    state.saving = true;
    state.saveId = state.saveId || (crypto.randomUUID?.() || `sv-${Date.now()}`);
    const drinkSubtype = a._drinkLogSubtype || null;
    const scored = a._confidence || scoreMealConfidence(a);
    root.innerHTML = `
      <section class="log-screen center">
        <div class="spinner" aria-hidden="true"></div>
        <h2>Saving…</h2>
      </section>
    `;
    try {
      const saved = await saveMeal({
        date: getLogTargetDate() || todayKey(),
        meal_type: state.mealType,
        meal_notes: state.mainlyDrink
          ? formatDrinkMealNotes(drinkSubtype, state.mealNotes) || undefined
          : state.mealNotes || undefined,
        meal_summary: a.meal_summary,
        total_calories_kcal: Math.round(a.total_calories_kcal),
        total_nutrition: a.total_nutrition,
        items: a.items,
        source: a.source || state.source || 'photo',
        barcode: barcodeFieldForMeal(a),
        confidence_score: scored.score,
        confidence_band: scored.band,
        kcal_range: scored.kcalRange || null,
        primary_uncertainty: scored.primaryUncertainty || '',
        clarifications: state.answers,
        photoDataUrl: state.image?.external ? undefined : state.image?.dataUrl,
        save_id: state.saveId,
        eaten_factor: a._eatenFactor || 1,
        _confidence: scored,
        _originalEstimate: a._originalEstimate || {
          total_calories_kcal: a.total_calories_kcal,
          total_nutrition: a.total_nutrition,
          items: a.items,
        },
      });
      clearSession();
      if (saved?.cloudSynced === false && profile?.loggedIn) {
        showToast('Saved on this device — cloud backup failed. Try Sync in Settings.');
      } else {
        showToast('Saved!');
      }
      onSaved();
    } catch (err) {
      state.saving = false;
      showToast(err.message || 'Could not save meal. Your review is still here — try Save again.');
      state.step = 'confirm';
      persist();
      render();
    }
  }

  render();
}

function friendlyAnalysisError(message = '') {
  if (/Sign in required/i.test(message)) {
    return 'Sign in to log meals with AI';
  }
  if (/Unable to process input image|INVALID_ARGUMENT/i.test(message)) {
    return 'Could not read that photo — try a clearer JPG or PNG, or a different angle';
  }
  if (/high demand|503/i.test(message)) {
    return 'AI is busy — wait a moment and try again';
  }
  if (/abort|timeout/i.test(message)) {
    return 'Analysis took too long — try again with a smaller photo';
  }
  if (/JSON|parse model JSON|after array element|after property value|Unexpected token/i.test(message)) {
    return 'Could not read that photo — try again, or type the drink in Describe.';
  }
  return message || 'Analysis failed — try again';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
