import { useEffect, useRef } from 'react';

export function useSpeechSynthesis() {
  const voicesRef = useRef([]);

  // Preload voices (they load asynchronously in some browsers)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  function speakEnglish(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : window.speechSynthesis.getVoices();
    const preferredNames = [
      'Samantha',           // macOS/iOS - natural female
      'Alex',               // macOS - natural male
      'Karen',              // macOS AU - natural female
      'Daniel',             // macOS UK - natural male
      'Google US English',  // Chrome
      'Microsoft Aria',     // Edge - natural female
      'Microsoft Jenny',    // Edge - natural female
      'Microsoft Guy',      // Edge - natural male
    ];

    let selectedVoice = null;
    for (const name of preferredNames) {
      selectedVoice = voices.find(v => v.name.includes(name) && v.lang.startsWith('en'));
      if (selectedVoice) break;
    }

    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        v.lang.startsWith('en-US') && !v.localService
      ) || voices.find(v => v.lang.startsWith('en-US'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  function speakJapanese(text, onDone) {
    if (!('speechSynthesis' in window)) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;

    const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
    const jpVoice =
      voices.find(v => v.lang.startsWith('ja') && (v.name.includes('Kyoko') || v.name.includes('Otoya'))) ||
      voices.find(v => v.lang.startsWith('ja') && !v.localService) ||
      voices.find(v => v.lang.startsWith('ja'));
    if (jpVoice) utterance.voice = jpVoice;

    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();
    window.speechSynthesis.speak(utterance);
  }

  return { speakEnglish, speakJapanese };
}
