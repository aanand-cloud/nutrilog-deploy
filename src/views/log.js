import {
  analyzeFoodPhoto,
  refineWithClarifications,
  compressImage,
  compressDataUrl,
  needsClarification,
  demoAnalysis,
} from '../services/ai-analysis.js';
import { openMealReviewModal } from '../services/meal-review-modal.js';
import { saveMeal, todayKey } from '../services/storage.js';
import { captureMealPhoto, pickMealPhotoFromGallery, isNativeApp } from '../services/camera.js';
import { canUseWebCamera, openWebCameraModal } from '../services/web-camera.js';
import { canScan, recordScan, scansLabel, resetScansForTesting, paywallMessage } from '../services/subscription.js';
import { isSupabaseConfigured } from '../services/auth.js';
import { defaultMealType } from '../services/meal-types.js';
import { lookupBarcodeProduct } from '../services/barcode.js';
import { openBarcodeScannerModal } from '../services/barcode-scanner.js';
import { lookupFoodProduct } from '../services/food-search.js';
import { openFoodSearchModal } from '../services/food-search-modal.js';
import { DISCLAIMERS, disclaimerBlock } from '../services/disclaimers.js';
import { requireAiProcessingConsent } from '../services/privacy-consent.js';
import {
  photoScanAnalyzingHtml,
  packagedLookupAnalyzingHtml,
  startPhotoScanStatusCycle,
  DRINK_ANALYSIS_STEPS,
} from '../services/analyze-scan-ui.js';
import {
  normalizeClarificationQuestions,
  getClarificationStepConfig,
} from '../services/clarification-questions.js';
import {
  drinkSubtypeChipsHtml,
  buildDrinkAnalysisNotes,
  formatDrinkMealNotes,
  inferMealTypeForDrink,
  getDrinkSubtype,
} from '../services/drink-logging.js';

/** Keeps photo flow alive if the screen re-renders mid-upload */
let activeLogState = null;
let analyzeStatusCleanup = null;

export function isLogBusy() {
  return activeLogState?.step === 'analyzing' || activeLogState?.step === 'clarify' || activeLogState?.step === 'review';
}

export function renderLog(root, { onSaved, onCancel, showToast, onUpgrade, profile, onSignIn }) {
  let state = activeLogState || {
    step: 'capture',
    image: null,
    analysis: null,
    answers: [],
    scanRecorded: false,
    status: '',
    mealType: defaultMealType(),
    mealNotes: '',
    drinkSubtype: null,
    drinkNotes: '',
    source: null,
  };

  function persist() {
    activeLogState = state;
  }

  function clearSession() {
    if (analyzeStatusCleanup) {
      analyzeStatusCleanup();
      analyzeStatusCleanup = null;
    }
    activeLogState = null;
  }

  function setStatus(msg) {
    state.status = msg;
    if (msg) showToast(msg, 4500);
  }

  function readMealNotesFromDom() {
    const el = root.querySelector('#mealNotesInput');
    if (el) state.mealNotes = el.value.trim();
  }

  function readDrinkNotesFromDom() {
    const el = root.querySelector('#drinkNotesInput');
    if (el) state.drinkNotes = el.value.trim();
    const active = root.querySelector('.drink-subtype-btn--active');
    if (active?.dataset.drinkSubtype) {
      state.drinkSubtype = active.dataset.drinkSubtype;
    }
  }

  function effectiveAnalysisNotes() {
    if (state.source === 'drink') {
      return buildDrinkAnalysisNotes(state.drinkSubtype, state.drinkNotes);
    }
    return state.mealNotes;
  }

  function prepareMealPhotoFlow() {
    state.source = 'meal';
    state.mealType = defaultMealType();
    readMealNotesFromDom();
  }

  function prepareDrinkPhotoFlow() {
    state.source = 'drink';
    readDrinkNotesFromDom();
    state.mealType = inferMealTypeForDrink(state.drinkSubtype);
  }

  function photoControlsHtml(section, { cameraHint, tipText, needsSignIn, photoBlocked, native, liveCamera, needsHttpsHint }) {
    const drink = section === 'drink';
    const camId = drink ? 'drinkCameraZone' : 'cameraZone';
    const liveId = drink ? 'drinkLiveCameraBtn' : 'liveCameraBtn';
    const photoInputId = drink ? 'drinkPhotoInput' : 'photoInput';
    const galleryInputId = drink ? 'drinkGalleryInput' : 'galleryInput';
    const galleryBtnId = drink ? 'drinkGalleryBtn' : 'galleryBtn';

    if (needsSignIn) {
      return `
        <section class="login-banner">
          <p><strong>Sign in required</strong> for photo-based logging. Packaged food below works without an account.</p>
          <button type="button" class="btn btn-primary btn-sm" id="logSignInBtn">Sign in / Create account</button>
        </section>
      `;
    }
    if (photoBlocked) {
      return `
        <div class="paywall-inline paywall-inline--prominent">
          <p class="paywall-inline__title">${canScan().isDaily ? "Today's photo allowance used" : 'Monthly allowance used'}</p>
          <p>${escapeHtml(paywallMessage(canScan()))}</p>
          <button type="button" class="btn btn-primary full" id="upgradeBtn">Upgrade or add logs</button>
          ${import.meta.env.DEV ? `<button type="button" class="btn btn-ghost full" id="resetScansBtn">Reset usage (dev only)</button>` : ''}
        </div>
      `;
    }
    return `
      ${native ? `
        <button type="button" class="camera-zone" id="${camId}">
          <span class="camera-icon">📷</span>
          <span class="camera-text">Take photo</span>
          <span class="camera-hint">${escapeHtml(cameraHint)}</span>
        </button>
        <button type="button" class="btn btn-ghost full" id="${galleryBtnId}">Choose from gallery</button>
      ` : `
        ${liveCamera ? `
          <button type="button" class="camera-zone" id="${liveId}">
            <span class="camera-icon">📷</span>
            <span class="camera-text">Open camera</span>
            <span class="camera-hint">${escapeHtml(cameraHint)}</span>
          </button>
        ` : `
          <div class="picker-wrap camera-zone">
            <input type="file" accept="image/*" capture="environment" id="${photoInputId}" class="picker-overlay" aria-label="Take photo"/>
            <div class="picker-label">
              <span class="camera-icon">📷</span>
              <span class="camera-text">Take photo</span>
              <span class="camera-hint">${escapeHtml(cameraHint)}</span>
            </div>
          </div>
        `}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp" id="${galleryInputId}" class="file-input-offscreen" aria-hidden="true" tabindex="-1"/>
        <button type="button" class="btn btn-ghost full" id="${galleryBtnId}">Choose from gallery</button>
        ${needsHttpsHint ? `<p class="fine-print warn-text log-section__warn">${import.meta.env.DEV ? `For phone camera: open <strong>https://${window.location.host}</strong> (not http). Gallery upload works on both.` : 'For phone camera on mobile, open NutriLog over a secure (HTTPS) connection. Gallery upload works either way.'}</p>` : ''}
      `}
      ${tipText ? `<p class="fine-print log-section__tip">${tipText}</p>` : ''}
    `;
  }

  function bindPhotoControls(section) {
    const drink = section === 'drink';
    const camId = drink ? '#drinkCameraZone' : '#cameraZone';
    const liveId = drink ? '#drinkLiveCameraBtn' : '#liveCameraBtn';
    const photoInputId = drink ? '#drinkPhotoInput' : '#photoInput';
    const galleryInputId = drink ? '#drinkGalleryInput' : '#galleryInput';
    const galleryBtnId = drink ? '#drinkGalleryBtn' : '#galleryBtn';
    const onPhoto = drink ? onDrinkPhotoSelected : onMealPhotoSelected;
    const openCam = drink ? openDrinkCamera : openMealCamera;
    const openLive = drink ? openDrinkLiveCamera : openMealLiveCamera;
    const openGal = drink ? openDrinkGallery : openMealGallery;

    root.querySelector(camId)?.addEventListener('click', openCam);
    root.querySelector(liveId)?.addEventListener('click', openLive);
    root.querySelector(photoInputId)?.addEventListener('change', onPhoto);
    const galleryInput = root.querySelector(galleryInputId);
    const galleryBtn = root.querySelector(galleryBtnId);
    if (galleryInput && galleryBtn) {
      galleryBtn.addEventListener('click', () => {
        galleryInput.value = '';
        galleryInput.click();
      });
      galleryInput.addEventListener('change', onPhoto);
    } else if (galleryBtn) {
      galleryBtn.addEventListener('click', openGal);
    }
  }

  function renderCapture() {
    const scan = canScan();
    const native = isNativeApp();
    const liveCamera = !native && canUseWebCamera();
    const needsHttpsHint = !native && !window.isSecureContext;
    const needsSignIn = isSupabaseConfigured() && !profile?.loggedIn;
    const photoBlocked = !needsSignIn && !scan.allowed;
    const photoOpts = { needsSignIn, photoBlocked, native, liveCamera, needsHttpsHint };
    const drinkSub = getDrinkSubtype(state.drinkSubtype);
    const drinkPlaceholder = drinkSub?.notesPlaceholder
      || 'e.g. oat latte no sugar · diet cola · glass of wine';

    root.innerHTML = `
      <section class="log-screen">
        <button type="button" class="back-link" id="cancelLog">← Back</button>
        <h2>Log food &amp; drinks</h2>
        <p class="log-screen__lead">Choose what you are logging — meals, packaged products, or beverages.</p>

        <section class="log-section log-section--photo" aria-labelledby="logPhotoHeading">
          <header class="log-section__head">
            <h3 class="log-section__title" id="logPhotoHeading">Cooked meal</h3>
            <p class="log-section__desc">Photograph your plate — homemade, restaurant, or any cuisine.</p>
          </header>
          ${!needsSignIn ? `<p class="scan-badge ${scan.allowed ? '' : 'scan-badge--limit'}">${scansLabel()}</p>` : ''}
          <label class="field full meal-hints-field">
            <span>Meal notes <em class="optional-tag">optional</em></span>
            <textarea id="mealNotesInput" rows="2" maxlength="280" placeholder="Add context the photo may not show — e.g. &quot;homemade biryani, light oil, half portion&quot;">${escapeHtml(state.mealNotes)}</textarea>
          </label>
          ${photoControlsHtml('meal', {
            ...photoOpts,
            cameraHint: 'Include the full plate for the most accurate estimate',
            tipText: 'Tip: good lighting and a top-down angle improve portion estimates.',
          })}
          ${disclaimerBlock(DISCLAIMERS.aiPhoto, 'fine-print health-disclaimer log-section__disclaimer')}
        </section>

        <section class="log-section log-section--drinks" aria-labelledby="logDrinksHeading">
          <header class="log-section__head">
            <h3 class="log-section__title" id="logDrinksHeading">Drinks &amp; beverages</h3>
            <p class="log-section__desc">Photograph your cup, glass, or bottle — coffee, tea, juice, soft drinks, and alcohol.</p>
          </header>
          ${!needsSignIn ? `<p class="scan-badge ${scan.allowed ? '' : 'scan-badge--limit'}">${scansLabel()}</p>` : ''}
          <p class="step-label drink-subtype-label">What type of drink? <em class="optional-tag">optional</em></p>
          <div class="drink-subtype-row" role="group" aria-label="Drink type">
            ${drinkSubtypeChipsHtml(state.drinkSubtype)}
          </div>
          <label class="field full meal-hints-field">
            <span>Drink notes <em class="optional-tag">optional</em></span>
            <textarea id="drinkNotesInput" rows="2" maxlength="280" placeholder="${escapeAttr(drinkPlaceholder)}">${escapeHtml(state.drinkNotes)}</textarea>
          </label>
          ${photoControlsHtml('drink', {
            ...photoOpts,
            cameraHint: 'Include the full cup or glass — volume estimates use millilitres (ml)',
            tipText: 'Tip: we will ask about milk, sugar, or pour size if needed.',
          })}
          ${disclaimerBlock(DISCLAIMERS.aiPhoto, 'fine-print health-disclaimer log-section__disclaimer')}
        </section>

        <section class="log-section log-section--packaged" aria-labelledby="logPackagedHeading">
          <header class="log-section__head">
            <h3 class="log-section__title" id="logPackagedHeading">Packaged food</h3>
            <p class="log-section__desc">Supermarket items with a barcode or brand name — ready meals, cereals, snacks, and labelled products.</p>
            <p class="log-section__note">Free to use · No account required · Does not use your photo allowance</p>
            ${photoBlocked ? `<p class="log-section__highlight">You can still log packaged items here while your photo allowance resets.</p>` : ''}
          </header>
          <div class="log-section__actions">
            <button type="button" class="btn btn-ghost full" id="barcodeBtn">Scan barcode</button>
            <button type="button" class="btn btn-ghost full" id="foodSearchBtn">Search brand or product</button>
          </div>
          ${disclaimerBlock(DISCLAIMERS.packagedFood, 'fine-print health-disclaimer log-section__disclaimer')}
        </section>

        ${state.status ? `<p class="log-status" id="logStatus">${escapeHtml(state.status)}</p>` : ''}
      </section>
    `;

    root.querySelector('#cancelLog')?.addEventListener('click', () => { clearSession(); onCancel(); });
    root.querySelector('#logSignInBtn')?.addEventListener('click', () => onSignIn?.());
    bindPhotoControls('meal');
    bindPhotoControls('drink');
    root.querySelectorAll('[data-drink-subtype]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.drinkSubtype;
        state.drinkSubtype = state.drinkSubtype === id ? null : id;
        render();
      });
    });
    root.querySelector('#barcodeBtn')?.addEventListener('click', openBarcode);
    root.querySelector('#foodSearchBtn')?.addEventListener('click', openFoodSearch);
    root.querySelectorAll('#upgradeBtn').forEach((btn) => btn.addEventListener('click', () => onUpgrade?.()));
    root.querySelector('#resetScansBtn')?.addEventListener('click', () => {
      resetScansForTesting();
      showToast('Usage reset — try again');
      render();
    });
  }

  function render() {
    if (state.step !== 'analyzing' && analyzeStatusCleanup) {
      analyzeStatusCleanup();
      analyzeStatusCleanup = null;
    }
    if (state.step !== 'capture') persist();
    if (state.step === 'capture') renderCapture();
    else if (state.step === 'paywall') renderPaywall();
    else if (state.step === 'analyzing') renderAnalyzing();
    else if (state.step === 'clarify') renderClarify();
    else if (state.step === 'review') showReviewFlow();
  }

  async function openBarcode() {
    readMealNotesFromDom();
    try {
      const code = await openBarcodeScannerModal();
      if (!code) return;
      await lookupPackagedFood(code, 'barcode');
    } catch (err) {
      showToast(err.message || 'Barcode lookup failed');
      state.step = 'capture';
      state.source = null;
      persist();
      render();
    }
  }

  async function openFoodSearch() {
    readMealNotesFromDom();
    try {
      const code = await openFoodSearchModal();
      if (!code) return;
      await lookupPackagedFood(code, 'food_search');
    } catch (err) {
      showToast(err.message || 'Food lookup failed');
      state.step = 'capture';
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

  async function openMealLiveCamera() {
    prepareMealPhotoFlow();
    return openLiveCameraCore();
  }

  async function openDrinkLiveCamera() {
    prepareDrinkPhotoFlow();
    return openLiveCameraCore();
  }

  async function openLiveCameraCore() {
    if (!canScan().allowed) {
      state.step = 'paywall';
      render();
      return;
    }
    try {
      const img = await openWebCameraModal();
      if (img) await useImage(img);
    } catch (err) {
      showToast(err.message || 'Camera failed');
    }
  }

  function renderPaywall() {
    const scan = canScan();
    root.innerHTML = `
      <section class="log-screen center">
        <h2>${scan.isDaily ? "Today's limit reached" : 'Monthly limit reached'}</h2>
        <p class="lead">${escapeHtml(paywallMessage(scan))}</p>
        <button type="button" class="btn btn-primary full" id="upgradeBtn">View plans &amp; top-ups</button>
        <button type="button" class="btn btn-ghost full" id="backCapture">Back</button>
      </section>
    `;
    root.querySelector('#upgradeBtn').addEventListener('click', () => onUpgrade?.());
    root.querySelector('#backCapture').addEventListener('click', () => { state.step = 'capture'; render(); });
  }

  async function openMealCamera() {
    prepareMealPhotoFlow();
    return openCameraCore();
  }

  async function openDrinkCamera() {
    prepareDrinkPhotoFlow();
    return openCameraCore();
  }

  async function openCameraCore() {
    if (!canScan().allowed) {
      state.step = 'paywall';
      render();
      return;
    }
    try {
      const native = await captureMealPhoto();
      if (native) await useImage(native);
    } catch (err) {
      showToast(err.message || 'Camera failed');
    }
  }

  async function openMealGallery() {
    prepareMealPhotoFlow();
    return openGalleryCore();
  }

  async function openDrinkGallery() {
    prepareDrinkPhotoFlow();
    return openGalleryCore();
  }

  async function openGalleryCore() {
    if (!canScan().allowed) {
      state.step = 'paywall';
      render();
      return;
    }
    try {
      const img = await pickMealPhotoFromGallery();
      if (img) await useImage(img);
    } catch (err) {
      showToast(err.message || 'Could not open gallery');
    }
  }

  async function onMealPhotoSelected(e) {
    prepareMealPhotoFlow();
    return onPhotoSelectedCore(e);
  }

  async function onDrinkPhotoSelected(e) {
    prepareDrinkPhotoFlow();
    return onPhotoSelectedCore(e);
  }

  async function onPhotoSelectedCore(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '')) {
      setStatus('Please choose a photo (JPG, PNG, or WebP)');
      state.step = 'capture';
      persist();
      render();
      return;
    }
    if (!canScan().allowed) {
      state.step = 'paywall';
      persist();
      render();
      return;
    }
    state.status = `Reading ${file.name || 'photo'}…`;
    state.step = 'capture';
    persist();
    render();
    try {
      const compressed = await compressImage(file);
      if (!compressed?.base64) throw new Error('Photo was empty — try another image');
      input.value = '';
      await useImage(compressed);
    } catch (err) {
      state.status = err.message || 'Could not read photo — try JPG or PNG';
      state.step = 'capture';
      persist();
      render();
      showToast(state.status, 5000);
    }
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
    if (state.source === 'drink') readDrinkNotesFromDom();
    else readMealNotesFromDom();
    try {
      if (image?.dataUrl && !image.external) {
        try {
          image = await compressDataUrl(image.dataUrl, image.mimeType);
        } catch (_) {
          /* use original if compression fails */
        }
      }
      state.image = image;
      state.step = 'analyzing';
      state.status = state.source === 'drink' ? 'Analysing your drink…' : 'Analysing your meal…';
      persist();
      render();
      await runAnalysis();
    } catch (err) {
      setStatus(err.message || 'Something went wrong — try again');
      state.step = 'capture';
      persist();
      render();
    }
  }

  async function runAnalysis() {
    const notes = effectiveAnalysisNotes();
    try {
      state.analysis = await analyzeFoodPhoto(
        state.image.base64,
        state.image.mimeType,
        notes
      );
      if (state.source === 'drink') {
        state.analysis._drinkLogSubtype = state.drinkSubtype || null;
      }
      if (!isSupabaseConfigured() && !state.scanRecorded) {
        recordScan();
        state.scanRecorded = true;
      }
      state.status = '';
    } catch (err) {
      if (err?.requiresAuth) {
        showToast('Sign in to log meals with AI', 5000);
        onSignIn?.();
        state.step = 'capture';
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
        if (state.source === 'drink') {
          state.analysis._drinkLogSubtype = state.drinkSubtype || null;
        }
        state.status = state.source === 'drink'
          ? 'Sample estimate only — connect AI for your actual drink'
          : 'Sample estimate only — connect AI for your actual meal';
      } else if (needsKey) {
        const msg = 'Photo logging is temporarily unavailable. You can still log packaged food by barcode or product search.';
        state.status = msg;
        state.step = 'capture';
        persist();
        render();
        showToast(msg, 6000);
        return;
      } else {
        const msg = friendlyAnalysisError(err.message);
        state.status = msg;
        state.step = 'capture';
        persist();
        render();
        showToast(msg, 6000);
        return;
      }
    }
    if (needsClarification(state.analysis)) {
      state.clarificationSteps = normalizeClarificationQuestions(state.analysis);
      state.step = 'clarify';
      state.answers = [];
    } else {
      state.step = 'review';
    }
    persist();
    render();
  }

  function renderAnalyzing() {
    if (analyzeStatusCleanup) {
      analyzeStatusCleanup();
      analyzeStatusCleanup = null;
    }

    const isLookup = state.source === 'barcode' || state.source === 'food_search';
    const isDrink = state.source === 'drink';
    const scanPanel = isLookup
      ? packagedLookupAnalyzingHtml(state.image?.dataUrl, {
          title: 'Looking up food…',
          subtitle: 'Fetching nutrition from product database…',
        })
      : photoScanAnalyzingHtml(state.image?.dataUrl, isDrink ? {
          title: 'Analysing your drink…',
          steps: DRINK_ANALYSIS_STEPS,
          photoAlt: 'Your drink photo',
        } : undefined);

    root.innerHTML = `
      <section class="log-screen log-screen--analyzing ${isLookup ? 'center' : ''}">
        ${scanPanel}
        ${!isLookup ? disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer meal-scan__disclaimer') : ''}
      </section>
    `;

    if (!isLookup) {
      analyzeStatusCleanup = startPhotoScanStatusCycle(root);
    }
  }

  function renderClarify() {
    const steps = state.clarificationSteps?.length
      ? state.clarificationSteps
      : normalizeClarificationQuestions(state.analysis);
    const current = state.answers.length;
    const step = steps[current];
    if (!step) {
      state.step = 'review';
      render();
      return;
    }
    const ui = getClarificationStepConfig(step, state.analysis);
    const total = steps.length;

    root.innerHTML = `
      <section class="log-screen log-screen--clarify">
        ${state.image?.dataUrl ? `<img src="${state.image.dataUrl}" alt="" class="preview-img preview-img--small"/>` : ''}
        <p class="step-label">Quick question ${current + 1} of ${total}</p>
        <h2 class="clarify-question">${escapeHtml(ui.question)}</h2>
        <p class="clarify-helper">${escapeHtml(ui.helper)}</p>
        <div class="option-grid" id="optionGrid">
          ${ui.options.map((o) => `<button type="button" class="option-btn" data-answer="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join('')}
        </div>
        <label class="field">
          <span>${escapeHtml(ui.inputLabel)}</span>
          <input type="text" id="customAnswer" inputmode="${escapeAttr(ui.inputMode)}" placeholder="${escapeAttr(ui.inputPlaceholder)}"/>
        </label>
        <button type="button" class="btn btn-primary full" id="submitAnswer">Continue</button>
        <button type="button" class="btn btn-ghost full" id="skipClarify">Skip — use best guess</button>
        ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer')}
      </section>
    `;

    root.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => submitAnswer(btn.dataset.answer));
    });
    root.querySelector('#submitAnswer').addEventListener('click', () => {
      const custom = root.querySelector('#customAnswer').value.trim();
      if (custom) submitAnswer(custom);
      else showToast('Pick an option or type an answer');
    });
    root.querySelector('#skipClarify').addEventListener('click', () => {
      state.step = 'review';
      render();
    });
  }

  async function submitAnswer(answer) {
    const steps = state.clarificationSteps?.length
      ? state.clarificationSteps
      : normalizeClarificationQuestions(state.analysis);
    const idx = state.answers.length;
    state.answers.push({
      question: steps[idx].question,
      answer,
      topic: steps[idx].topic,
    });
    if (state.answers.length < steps.length) {
      render();
      return;
    }
    state.step = 'analyzing';
    render();
    try {
      state.analysis = await refineWithClarifications(
        state.image.base64,
        state.image.mimeType,
        state.analysis,
        state.answers,
        effectiveAnalysisNotes()
      );
      if (state.source === 'drink') {
        state.analysis._drinkLogSubtype = state.drinkSubtype || null;
      }
    } catch (_) {
      showToast('Could not refine — showing previous estimate');
    }
    state.step = 'review';
    render();
  }

  async function showReviewFlow() {
    const isDrink = state.source === 'drink';
    root.innerHTML = `
      <section class="log-screen center">
        ${state.image?.dataUrl ? `<img src="${state.image.dataUrl}" alt="" class="preview-img preview-img--small"/>` : ''}
        <div class="spinner" aria-hidden="true"></div>
        <h2>${isDrink ? 'Review your drink' : 'Review your meal'}</h2>
        <p>${isDrink ? 'Check volume and add anything the camera missed.' : 'Check portions and add anything the camera missed.'}</p>
      </section>
    `;

    const result = await openMealReviewModal(state.analysis, {
      mealType: state.mealType,
      imageDataUrl: state.image?.dataUrl || null,
    });

    if (!result) {
      state.step = 'capture';
      persist();
      render();
      return;
    }

    state.analysis = result.analysis;
    state.mealType = result.mealType;
    await commitMealSave();
  }

  async function commitMealSave() {
    const a = state.analysis;
    root.innerHTML = `
      <section class="log-screen center">
        <div class="spinner" aria-hidden="true"></div>
        <h2>Saving…</h2>
      </section>
    `;
    try {
      const saved = await saveMeal({
        date: todayKey(),
        meal_type: state.mealType,
        meal_notes: state.source === 'drink'
          ? formatDrinkMealNotes(state.drinkSubtype, state.drinkNotes) || undefined
          : state.mealNotes || undefined,
        meal_summary: a.meal_summary,
        total_calories_kcal: a.total_calories_kcal,
        total_nutrition: a.total_nutrition,
        items: a.items,
        confidence_score: a.confidence_score,
        clarifications: state.answers,
        photoDataUrl: state.image?.external ? undefined : state.image?.dataUrl,
      });
      clearSession();
      if (saved?.cloudSynced === false && profile?.loggedIn) {
        showToast('Saved on this device — cloud backup failed. Try Sync in Settings.');
      } else {
        showToast(state.source === 'drink' ? 'Drink saved!' : 'Meal saved!');
      }
      onSaved();
    } catch (err) {
      showToast(err.message || 'Could not save meal');
      state.step = 'review';
      persist();
      showReviewFlow();
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
