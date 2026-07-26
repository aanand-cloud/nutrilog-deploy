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
    const onUnsupported = () => onMessage?.(speechInputUnavailableMessage());
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
    button.setAttribute('aria-label', value ? 'Stop listening' : button.dataset.labelIdle || 'Speak your answer');
    onListeningChange?.(value);
  }

  function ensureRecognition() {
    if (recognition) return recognition;
    recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onend = () => {
      setListening(false);
      if (activeCtrl?.recognition === recognition) activeCtrl = null;
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (activeCtrl?.recognition === recognition) activeCtrl = null;
      const code = event.error || '';
      if (code === 'aborted') return;
      if (code === 'no-speech') {
        onMessage?.('Did not catch that — try again or type');
        return;
      }
      if (code === 'not-allowed') {
        onMessage?.('Microphone blocked — allow mic in browser settings');
        return;
      }
      if (code === 'network') {
        onMessage?.('Voice needs a connection on this browser — type instead');
        return;
      }
      onMessage?.('Could not use voice — type your answer');
    };

    recognition.onresult = (event) => {
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

    return recognition;
  }

  function stopActive() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch (_) {
      /* ignore */
    }
    try {
      recognition.abort();
    } catch (_) {
      /* ignore */
    }
    setListening(false);
  }

  function toggle() {
    if (listening) {
      stopSpeechInput();
      return;
    }

    stopSpeechInput();
    baseText = append ? input.value.trim() : '';
    const rec = ensureRecognition();
    activeCtrl = { abort: stopActive, recognition: rec };

    try {
      rec.start();
    } catch (_) {
      setListening(false);
      activeCtrl = null;
      onMessage?.('Could not start microphone — try again');
    }
  }

  button.addEventListener('click', toggle);

  return () => {
    button.removeEventListener('click', toggle);
    if (activeCtrl?.recognition === recognition) stopSpeechInput();
  };
}
