import { useState, useRef, useEffect } from 'react';

// Wraps Web Speech API recognition with React state.
// Continuous mode: keeps listening until stop() is called explicitly,
// so the user can pause mid-sentence without recognition cutting off.
// onUnsupported fires once if the browser lacks the API.
export function useSpeechRecognition({ onUnsupported } = {}) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const onUnsupportedRef = useRef(onUnsupported);

  useEffect(() => {
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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setTranscript((finalText + interimText).trim());
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
