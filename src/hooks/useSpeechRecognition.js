import { useState, useRef, useEffect } from 'react';

// Wraps Web Speech API recognition with React state.
// Continuous mode + auto-restart: Chrome ends recognition after a few seconds
// of silence even in continuous mode, so we restart it transparently until
// stop() is called explicitly. Finals are accumulated across restarts.
// onUnsupported fires once if the browser lacks the API.
export function useSpeechRecognition({ onUnsupported } = {}) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  // Finals from the CURRENT recognition session, keyed by result index so
  // Chrome re-emitting the same index overwrites rather than appends.
  const finalsRef = useRef([]);
  // Finals carried over from previous sessions (after auto-restart on onend).
  const carriedFinalsRef = useRef('');
  // True once the user clicked stop(); prevents the onend auto-restart loop.
  const userStoppedRef = useRef(false);
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
    userStoppedRef.current = true;
    if (recognitionRef.current) {
      detach();
    }
    setIsListening(false);
  }

  function reset() {
    finalsRef.current = [];
    carriedFinalsRef.current = '';
    setTranscript('');
  }

  function buildDisplay(interim) {
    const sessionFinal = finalsRef.current.filter(Boolean).join(' ').trim();
    const combinedFinal = [carriedFinalsRef.current, sessionFinal]
      .filter(Boolean)
      .join(' ')
      .trim();
    const interimTrim = (interim || '').trim();
    const sep = combinedFinal && interimTrim ? ' ' : '';
    return (combinedFinal + sep + interimTrim).trim();
  }

  function spawnRecognition() {
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
      let interim = '';
      // resultIndex is the index of the first changed result; iterate from
      // there to avoid re-processing already-stable entries (which causes
      // word duplication when Chrome re-emits the same index).
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalsRef.current[i] = r[0].transcript.trim();
        } else {
          interim += r[0].transcript;
        }
      }
      setTranscript(buildDisplay(interim));
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      userStoppedRef.current = true;
      setIsListening(false);
      alert('Speech recognition error: ' + event.error);
    };

    recognition.onend = () => {
      if (userStoppedRef.current) {
        setIsListening(false);
        return;
      }
      // Chrome auto-ended (silence timeout). Carry finals over and restart
      // so the user can keep talking without losing what was recognized.
      const sessionFinal = finalsRef.current.filter(Boolean).join(' ').trim();
      if (sessionFinal) {
        carriedFinalsRef.current = [carriedFinalsRef.current, sessionFinal]
          .filter(Boolean)
          .join(' ')
          .trim();
      }
      finalsRef.current = [];
      recognitionRef.current = null;
      try {
        spawnRecognition();
      } catch (e) {
        console.error('Failed to restart recognition:', e);
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function start() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      onUnsupportedRef.current?.();
      return;
    }

    detach();
    finalsRef.current = [];
    carriedFinalsRef.current = '';
    userStoppedRef.current = false;
    setTranscript('');

    try {
      spawnRecognition();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setIsListening(false);
    }
  }

  return { start, stop, reset, transcript, isListening };
}
