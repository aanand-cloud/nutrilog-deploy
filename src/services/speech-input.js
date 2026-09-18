/** Browser speech-to-text for clarify answers and meal notes (no Gemini cost). */

let activeCtrl = null;

export function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechInputSupported() {
  return !!getSpeechRecognitionCtor();
}

/** Plain-English reason when the mic button cannot run speech-to-text. */
export function speechInputUnavailableMessage() {
  if (!window.isSecureContext) {
    return 'Voice input needs a secure connection (https). Type your answer instead.';
  }
  if (!getSpeechRecognitionCtor()) {
    return 'Voice works best in Chrome or Edge on phone/desktop. You can still type.';
  }
  return 'Voice input is not available here — type your answer instead.';
}

export function stopSpeechInput() {
  if (!activeCtrl) return;
  try {
    activeCtrl.abort();
  } catch (_) {
    /* ignore */
  }
  activeCtrl = null;
}

/**
 * Wire a mic button to a text input or textarea.
 * @returns {() => void} cleanup
 */
export function attachSpeechInput({
  input,
  button,
  append = false,
  lang = 'en-GB',
  onListeningChange,
  onMessage,
}) {
  stopSpeechInput();

  if (!input || !button) return () => {};
  if (!isSpeechInputSupported()) {
    const onUnsupported = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onMessage?.(speechInputUnavailableMessage());
    };
    button.addEventListener('click', onUnsupported);
    return () => button.removeEventListener('click', onUnsupported);
  }

  const SpeechRecognition = getSpeechRecognitionCtor();
  let recognition = null;
  let listening = false;
  let baseText = '';

  function setListening(value) {
    listening = value;
    button.classList.toggle('speech-mic-btn--active', value);
    button.setAttribute('aria-pressed', value ? 'true' : 'false');
    button.setAttribute('aria-label', value ? 'Stop listening' : button.dataset.labelIdle || 'Talk');
    const label = button.querySelector('.speech-mic-btn__text');
    if (label) label.textContent = value ? 'Listening…' : 'Talk';
    onListeningChange?.(value);
  }

  function disposeRecognition() {
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.abort();
    } catch (_) {
      /* ignore */
    }
    recognition = null;
  }

  function createRecognition() {
    disposeRecognition();
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onend = () => {
      setListening(false);
      if (activeCtrl?.recognition === rec) activeCtrl = null;
      // Drop the instance — Chrome often refuses start() after abort/end on the same object.
      if (recognition === rec) recognition = null;
    };

    rec.onerror = (event) => {
      setListening(false);
      if (activeCtrl?.recognition === rec) activeCtrl = null;
      const code = event.error || '';
      if (code === 'aborted') return;
      if (code === 'no-speech') {
        onMessage?.('Did not catch that — try again or type');
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        onMessage?.('Microphone blocked — allow mic in browser settings');
        return;
      }
      if (code === 'network') {
        onMessage?.('Voice needs a connection on this browser — type instead');
        return;
      }
      onMessage?.('Could not use voice — type your answer');
    };

    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      const spoken = (finalText || interim).trim();
      if (!spoken) return;

      if (finalText) {
        const merged = baseText ? `${baseText} ${finalText.trim()}` : finalText.trim();
        input.value = merged;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      input.value = baseText ? `${baseText} ${interim.trim()}` : interim.trim();
    };

    recognition = rec;
    return rec;
  }

  function stopActive() {
    const rec = recognition;
    if (!rec) {
      setListening(false);
      return;
    }
    try {
      rec.stop();
    } catch (_) {
      try {
        rec.abort();
      } catch (__) {
        /* ignore */
      }
    }
    setListening(false);
  }

  function startListening() {
    baseText = append ? input.value.trim() : '';
    const rec = createRecognition();
    activeCtrl = { abort: stopActive, recognition: rec };

    try {
      rec.start();
    } catch (err) {
      // Retry once with a fresh instance (handles InvalidStateError after prior abort).
      try {
        const retry = createRecognition();
        activeCtrl = { abort: stopActive, recognition: retry };
        retry.start();
      } catch (_) {
        setListening(false);
        activeCtrl = null;
        onMessage?.('Could not start microphone — try again');
      }
    }
  }

  function toggle(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (listening) {
      stopSpeechInput();
      return;
    }

    stopSpeechInput();
    startListening();
  }

  button.addEventListener('click', toggle);

  return () => {
    button.removeEventListener('click', toggle);
    if (activeCtrl?.recognition === recognition) stopSpeechInput();
    disposeRecognition();
  };
}
