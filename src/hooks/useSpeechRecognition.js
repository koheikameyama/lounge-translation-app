import { useState, useRef, useEffect } from 'react';

// Wraps Web Speech API recognition with React state.
// onFinal fires when a result with isFinal === true arrives.
// onUnsupported fires once if the browser lacks the API.
export function useSpeechRecognition({ onFinal, onUnsupported } = {}) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  const onUnsupportedRef = useRef(onUnsupported);

  useEffect(() => {
    onFinalRef.current = onFinal;
    onUnsupportedRef.current = onUnsupported;
  });

  function detach() {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore - already stopped
      }
      recognitionRef.current = null;
    }
  }

  function stop() {
    if (recognitionRef.current) {
      detach();
      setIsListening(false);
    }
  }

  function start() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      onUnsupportedRef.current?.();
      return;
    }

    // Always stop any existing recognition first to avoid duplicate recognition
    detach();

    // Clear any previous text
    setTranscript('');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false; // single-shot recognition (prevents duplicate accumulation)
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const t = result[0].transcript;
      setTranscript(t);
      if (result.isFinal) {
        onFinalRef.current?.();
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      setIsListening(false);
      alert('Speech recognition error: ' + event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function reset() {
    setTranscript('');
  }

  return { start, stop, reset, transcript, isListening };
}
