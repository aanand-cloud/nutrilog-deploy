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
  PHOTO_ANALYSIS_STEPS,
} from '../services/analyze-scan-ui.js';
import {
  normalizeClarificationQuestions,
  getClarificationStepConfig,
} from '../services/clarification-questions.js';
import {
  buildPhotoAnalysisNotes,
  formatDrinkMealNotes,
  inferMealTypeForDrink,
  analysisIsMainlyDrink,
  inferDrinkSubtypeFromAnalysis,
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
    mainlyDrink: false,
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
    state.mealType = inferMealTypeForDrink(analysis._drinkLogSubtype);
  }

  function clearPhotoFlow() {
    state.source = null;
    state.mainlyDrink = false;
  }

  function preparePhotoFlow() {
    state.source = 'photo';
    state.mainlyDrink = false;
    state.mealType = defaultMealType();
    readNotesFromDom();
  }

  function photoPaywallTitle(budget = canScan()) {
    if (budget.reason === 'upgrade_required') return 'Upgrade for AI photo logging';
    if (budget.reason === 'daily_cap') return "Today's fair use limit reached";
    return budget.isDaily ? "Today's photo allowance used" : 'Monthly allowance used';
  }

  function photoControlsHtml({ cameraHint, tipText, needsSignIn, photoBlocked, native, liveCamera, needsHttpsHint }) {

    if (needsSignIn) {
      return `
        <section class="login-banner">
          <p><strong>Sign in required</strong> for photo-based logging. Packaged food below works without an account.</p>
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
          <button type="button" class="btn btn-primary full" id="upgradeBtn">View plans</button>
          ${import.meta.env.DEV ? `<button type="button" class="btn btn-ghost full" id="resetScansBtn">Reset usage (dev only)</button>` : ''}
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
            <input type="file" accept="image/*" capture="environment" id="photoInput" class="picker-overlay" aria-label="Take photo"/>
            <div class="picker-label">
              <span class="camera-icon">📷</span>
              <span class="camera-text">Take photo</span>
              <span class="camera-hint">${escapeHtml(cameraHint)}</span>
            </div>
          </div>
        `}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp" id="galleryInput" class="file-input-offscreen" aria-hidden="true" tabindex="-1"/>
        <button type="button" class="btn btn-ghost full" id="galleryBtn">Choose from gallery</button>
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
  }

  function renderCapture() {
    const scan = canScan();
    const native = isNativeApp();
    const liveCamera = !native && canUseWebCamera();
    const needsHttpsHint = !native && !window.isSecureContext;
    const needsSignIn = isSupabaseConfigured() && !profile?.loggedIn;
    const photoBlocked = !needsSignIn && !scan.allowed;
    const photoOpts = { needsSignIn, photoBlocked, native, liveCamera, needsHttpsHint };

    root.innerHTML = `
      <section class="log-screen">
        <button type="button" class="back-link" id="cancelLog">← Back</button>
        <h2>Log food &amp; drinks</h2>
        <p class="log-screen__lead">Take a photo of your meal or drink, or scan packaged food below.</p>

        <section class="log-section log-section--photo" aria-labelledby="logPhotoHeading">
          <header class="log-section__head">
            <h3 class="log-section__title" id="logPhotoHeading">Take a photo</h3>
            <p class="log-section__desc">Works for plates, cups, and glasses — we detect food and drinks automatically.</p>
          </header>
          ${!needsSignIn ? `<p class="scan-badge ${scan.allowed ? '' : 'scan-badge--limit'}">${scansLabel()}</p>` : ''}
          <label class="field full meal-hints-field">
            <span>Notes <em class="optional-tag">optional</em></span>
            <textarea id="photoNotesInput" rows="2" maxlength="280" placeholder="Add anything the photo may not show — e.g. &quot;half portion&quot;, &quot;oat latte no sugar&quot;, &quot;diet cola&quot;">${escapeHtml(state.mealNotes)}</textarea>
          </label>
          ${photoControlsHtml({
            ...photoOpts,
            cameraHint: 'Include the full plate, cup, or glass',
            tipText: 'Tip: good lighting helps. We ask follow-up questions only when needed.',
          })}
          ${disclaimerBlock(DISCLAIMERS.aiPhoto, 'fine-print health-disclaimer log-section__disclaimer')}
        </section>

        <section class="log-section log-section--packaged" aria-labelledby="logPackagedHeading">
          <header class="log-section__head">
            <h3 class="log-section__title" id="logPackagedHeading">Packaged food</h3>
            <p class="log-section__desc">Supermarket items with a barcode or brand name — ready meals, cereals, snacks, and labelled products.</p>
            <p class="log-section__note">Free with sign-in · Does not use your photo allowance</p>
            ${photoBlocked && profile?.loggedIn ? `<p class="log-section__highlight">Barcode logging stays free on your account.</p>` : ''}
          </header>
          ${needsSignIn ? `
            <section class="login-banner">
              <p><strong>Sign in required</strong> for free barcode logging.</p>
              <button type="button" class="btn btn-primary btn-sm" id="packagedSignInBtn">Sign in</button>
            </section>
          ` : `
          <div class="log-section__actions">
            <button type="button" class="btn btn-ghost full" id="barcodeBtn">Scan barcode</button>
            <button type="button" class="btn btn-ghost full" id="foodSearchBtn">Search brand or product</button>
          </div>
          `}
          ${disclaimerBlock(DISCLAIMERS.packagedFood, 'fine-print health-disclaimer log-section__disclaimer')}
        </section>

        ${state.status ? `<p class="log-status" id="logStatus">${escapeHtml(state.status)}</p>` : ''}
      </section>
    `;

    root.querySelector('#cancelLog')?.addEventListener('click', () => { clearSession(); onCancel(); });
    root.querySelector('#logSignInBtn')?.addEventListener('click', () => onSignIn?.());
    root.querySelector('#packagedSignInBtn')?.addEventListener('click', () => onSignIn?.());
    bindPhotoControls();
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
      state.step = 'capture';
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

  async function openLiveCamera() {
    preparePhotoFlow();
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
        <h2>${photoPaywallTitle(scan)}</h2>
        <p class="lead">${escapeHtml(paywallMessage(scan))}</p>
        <button type="button" class="btn btn-primary full" id="upgradeBtn">View plans</button>
        <button type="button" class="btn btn-ghost full" id="backCapture">Back</button>
      </section>
    `;
    root.querySelector('#upgradeBtn').addEventListener('click', () => onUpgrade?.());
    root.querySelector('#backCapture').addEventListener('click', () => {
      state.step = 'capture';
      clearPhotoFlow();
      render();
    });
  }

  async function openCamera() {
    preparePhotoFlow();
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

  async function openGallery() {
    preparePhotoFlow();
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

  async function onPhotoSelected(e) {
    preparePhotoFlow();
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
      state.step = 'analyzing';
      state.status = 'Analysing your photo…';
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
      enrichDrinkContext(state.analysis);
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
        enrichDrinkContext(state.analysis);
        state.status = 'Sample estimate only — connect AI for your actual photo';
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
    const scanPanel = isLookup
      ? packagedLookupAnalyzingHtml(state.image?.dataUrl, {
          title: 'Looking up food…',
          subtitle: 'Fetching nutrition from product database…',
        })
      : photoScanAnalyzingHtml(state.image?.dataUrl);

    root.innerHTML = `
      <section class="log-screen log-screen--analyzing ${isLookup ? 'center' : ''}">
        ${scanPanel}
        ${!isLookup ? disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer meal-scan__disclaimer') : ''}
      </section>
    `;

    if (!isLookup) {
      analyzeStatusCleanup = startPhotoScanStatusCycle(root, PHOTO_ANALYSIS_STEPS);
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
      enrichDrinkContext(state.analysis);
    } catch (_) {
      showToast('Could not refine — showing previous estimate');
    }
    state.step = 'review';
    render();
  }

  async function showReviewFlow() {
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
      state.step = 'capture';
      clearPhotoFlow();
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
    const drinkSubtype = a._drinkLogSubtype || null;
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
        meal_notes: state.mainlyDrink
          ? formatDrinkMealNotes(drinkSubtype, state.mealNotes) || undefined
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
        showToast('Saved!');
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
