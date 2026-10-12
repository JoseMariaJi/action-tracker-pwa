const SpeechRecognitionAPI =
  globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

/**
 * Starts a one-shot speech recognition session.
 * Call this from a user action, such as a button click.
 *
 * @param {{ language?: string, onResult: (text: string) => void, onError?: (error: Event) => void }} options
 * @returns {SpeechRecognition}
 */
export function startSpeechRecognition({
  language = 'es-ES',
  onResult,
  onError,
} = {}) {
  if (typeof onResult !== 'function') {
    throw new TypeError('onResult debe ser una función.');
  }

  if (!SpeechRecognitionAPI) {
    throw new Error(
      'Este navegador no es compatible con la API de reconocimiento de voz.',
    );
  }

  const recognition = new SpeechRecognitionAPI();
  let transcript = '';
  let failed = false;

  recognition.lang = language;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    transcript = Array.from(event.results)
      .filter((result) => result.isFinal)
      .map((result) => result[0].transcript)
      .join(' ')
      .trim();
  };

  recognition.onerror = (event) => {
    failed = true;

    if (onError) {
      onError(event);
    } else {
      console.error('Error de reconocimiento de voz:', event.error);
    }
  };

  recognition.onend = () => {
    if (!failed) {
      onResult(transcript);
    }
  };

  recognition.start();
  return recognition;
}

export default startSpeechRecognition;