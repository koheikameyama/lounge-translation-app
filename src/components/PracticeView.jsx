import { useState, useEffect, useRef } from 'react';
import {
  Play, Plus, Check, X, ChevronLeft, ArrowRight,
  RotateCcw, ExternalLink, Sparkles, Mic, MicOff, Volume2,
} from 'lucide-react';
import { sessionsAPI } from '../api';
import { weightedShuffle, removeQNotation, todayStr, fmtMs } from '../utils/helpers';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export function PracticeView({ sentences, sessions, setSessions, setView }) {
  const [queue, setQueue] = useState(() => weightedShuffle(sentences, sessions));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('ready');
  const [startTs, setStartTs] = useState(null);
  const [now, setNow] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [exceeded5sec, setExceeded5sec] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const intervalRef = useRef(null);
  const sessionSavedRef = useRef(false);

  const { speakEnglish, speakJapanese } = useSpeechSynthesis();
  const recognition = useSpeechRecognition({
    onFinal: () => setHasAnswered(true),
    onUnsupported: () => setSpeechEnabled(false),
  });
  const { transcript: recognizedText, isListening } = recognition;

  const current = queue[idx];

  function handleReveal() {
    if (phase === 'timing') {
      recognition.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase('revealed');
      speakEnglish(current.en);
    }
  }

  function handleRate(result) {
    const ms = Date.now() - startTs;
    const newAttempt = {
      sentenceId: current.id,
      ms,
      result, // 'ok' or 'ng'
      exceeded5sec,
      recognizedText: recognizedText || null
    };
    const newAttempts = [...attempts, newAttempt];
    setAttempts(newAttempts);

    // Save this attempt to D1 immediately (don't wait until session is "done")
    const todayKey = todayStr();
    sessionsAPI.create({ date: todayKey, attempts: [newAttempt] }).then(() => {
      sessionsAPI.getAll().then(setSessions);
    }).catch(error => {
      console.error('Failed to save attempt:', error);
    });

    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      setPhase('ready');
    } else {
      setPhase('done');
    }
  }

  function handleSkip() {
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      setPhase('ready');
    } else {
      setPhase('done');
    }
  }

  // Reset & start timer/recognition after Japanese TTS finishes
  function startTimingAndRecognition() {
    const t = Date.now();
    setStartTs(t);
    setNow(t);
    let hasExceeded = false;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - t;
      setNow(Date.now());
      if (elapsed > 10000 && !hasExceeded) {
        hasExceeded = true;
        setExceeded5sec(true);
      }
    }, 50);

    if (speechEnabled) {
      setTimeout(() => recognition.start(), 100);
    }
  }

  useEffect(() => {
    if (phase === 'timing') {
      // Reset state, but don't start timer yet — wait for Japanese TTS to finish
      setNow(Date.now());
      setStartTs(null);
      setExceeded5sec(false);
      recognition.reset();
      setHasAnswered(false);

      const jpText = removeQNotation(current.jp);
      speakJapanese(jpText, () => {
        startTimingAndRecognition();
      });
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, idx, speechEnabled]);

  // Note: attempts are saved individually in handleRate(), no need for bulk save on done

  if (sentences.length === 0) {
    return (
      <div className="card rounded-2xl p-10 text-center anim-in">
        <h2 className="font-display text-2xl mb-3" style={{ fontWeight: 500 }}>
          No sentences yet
        </h2>
        <p className="text-stone-600 text-sm mb-6">
          Add some Japanese-English pairs first.
        </p>
        <button
          onClick={() => setView('sentences')}
          className="btn-amber px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add sentences
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    const total = attempts.length;
    const avg = attempts.reduce((a, b) => a + b.ms, 0) / Math.max(1, total);
    const ok = attempts.filter((a) => a.result === 'ok').length;
    const exceeded = attempts.filter((a) => a.exceeded5sec).length;
    return (
      <div className="card rounded-2xl p-10 text-center anim-in">
        <Sparkles className="w-7 h-7 mx-auto text-amber-600 mb-4" />
        <div className="text-xs uppercase tracking-widest text-amber-700 mb-2">Session complete</div>
        <h2 className="font-display text-3xl mb-6" style={{ fontWeight: 500 }}>
          {total} done.
        </h2>
        <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto mb-8">
          <SmallStat label="Sentences" value={total} />
          <SmallStat label="Avg time" value={fmtMs(avg)} />
          <SmallStat label="OK rate" value={`${Math.round((ok / total) * 100)}%`} />
          <SmallStat label="10sec+" value={exceeded} />
        </div>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setQueue(weightedShuffle(sentences, sessions));
              setIdx(0);
              setAttempts([]);
              sessionSavedRef.current = false;
              setPhase('ready');
            }}
            className="btn-amber px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Practice again
          </button>
          <button
            onClick={() => setView('home')}
            className="px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 border border-stone-300 hover:border-stone-900 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-in">
      <div className="flex items-center justify-between mb-6 text-xs">
        <button
          onClick={() => setView('home')}
          className="text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> back
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className="text-stone-500 hover:text-stone-900 inline-flex items-center gap-1.5 transition"
            title={speechEnabled ? 'Speech recognition ON' : 'Speech recognition OFF'}
          >
            {speechEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            {speechEnabled ? 'ON' : 'OFF'}
          </button>
          <div className="font-mono text-stone-500 flex items-center gap-2">
            {current?.number != null && (
              <span className="text-stone-400">#{current.number}</span>
            )}
            <span>{idx + 1} <span className="text-stone-400">/ {queue.length}</span></span>
          </div>
        </div>
      </div>

      <div className="card rounded-2xl p-8 sm:p-12 min-h-[420px] flex flex-col">
        {phase === 'ready' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-xs uppercase tracking-widest text-stone-500 mb-6">
              ready when you are
            </div>
            <button
              onClick={() => setPhase('timing')}
              className="btn-amber px-8 py-3 rounded-full text-base font-medium inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Show next sentence
            </button>
            <div className="text-xs text-stone-400 mt-8 max-w-xs">
              Timer starts the moment the sentence appears.
            </div>
          </div>
        )}

        {phase === 'timing' && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-xs uppercase tracking-widest text-amber-700 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                {hasAnswered ? 'answered' : 'translating'}
              </div>
              {current.number != null && (
                <div className="font-mono text-xs text-stone-400 mb-3">
                  #{current.number}
                </div>
              )}
              <div
                className="font-jp text-3xl sm:text-4xl leading-snug max-w-2xl transition-all duration-300"
                style={{
                  fontWeight: 500,
                  color: exceeded5sec ? '#dc2626' : 'inherit'
                }}
              >
                {removeQNotation(current.jp)}
              </div>
              <div className="font-mono mt-10 text-sm" style={{ color: exceeded5sec ? '#dc2626' : '#78716c' }}>
                {startTs ? fmtMs(now - startTs) : '読み上げ中...'}
                {exceeded5sec && <span className="ml-2 text-xs">⚠ 10sec exceeded</span>}
              </div>
              {isListening && (
                <div className="mt-4 text-xs text-amber-700 flex items-center gap-2 animate-pulse">
                  <Mic className="w-4 h-4" />
                  Listening...
                </div>
              )}
              {hasAnswered && recognizedText && (
                <div className="mt-6 max-w-md">
                  <div className="text-xs uppercase tracking-widest text-blue-700 mb-2 flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5" />
                      your answer
                    </span>
                    <button
                      onClick={() => {
                        recognition.stop();
                        recognition.reset();
                        setHasAnswered(false);
                        if (!intervalRef.current) {
                          let hasExceeded = exceeded5sec;
                          intervalRef.current = setInterval(() => {
                            const elapsed = Date.now() - startTs;
                            setNow(Date.now());
                            if (elapsed > 10000 && !hasExceeded) {
                              hasExceeded = true;
                              setExceeded5sec(true);
                            }
                          }, 50);
                        }
                        setTimeout(() => recognition.start(), 100);
                      }}
                      className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-50"
                      title="Redo recording"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Redo
                    </button>
                  </div>
                  <div className="font-display text-xl leading-snug text-blue-900 bg-blue-50 p-4 rounded-xl">
                    "{recognizedText}"
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-3 mt-6 flex-wrap">
              {!hasAnswered && (
                <>
                  {speechEnabled ? (
                    <>
                      {!isListening && (
                        <button
                          onClick={recognition.start}
                          className="px-6 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 border-2 border-amber-600 text-amber-700 hover:bg-amber-50 transition"
                        >
                          <Mic className="w-4 h-4" /> Speak answer
                        </button>
                      )}
                      {isListening && (
                        <button
                          onClick={recognition.stop}
                          className="px-6 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 border-2 border-red-600 text-red-700 hover:bg-red-50 transition"
                        >
                          <MicOff className="w-4 h-4" /> Stop
                        </button>
                      )}
                      <button
                        onClick={handleReveal}
                        className="px-4 py-2.5 rounded-full text-sm text-stone-500 hover:text-stone-900 transition"
                      >
                        skip
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setHasAnswered(true);
                          if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                          }
                        }}
                        className="btn-amber px-8 py-3 rounded-full text-base font-medium inline-flex items-center gap-2"
                      >
                        回答済 <ArrowRight className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleSkip}
                        className="px-4 py-2.5 rounded-full text-sm text-stone-500 hover:text-stone-900 transition"
                      >
                        skip
                      </button>
                    </>
                  )}
                </>
              )}
              {hasAnswered && (
                <button
                  onClick={handleReveal}
                  className="btn-amber px-8 py-3 rounded-full text-base font-medium inline-flex items-center gap-2"
                >
                  回答済（答えを見る） <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'revealed' && (
          <>
            <div className="flex-1 flex flex-col justify-center">
              {recognizedText && (
                <>
                  <div className="text-xs uppercase tracking-widest text-blue-700 mb-3 flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5" />
                    your answer
                  </div>
                  <div className="font-display text-xl sm:text-2xl mb-6 leading-snug text-blue-900 bg-blue-50 p-4 rounded-xl">
                    "{recognizedText}"
                  </div>
                </>
              )}
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-2">
                <span>jp</span>
                {current.number != null && (
                  <span className="font-mono text-stone-400">#{current.number}</span>
                )}
              </div>
              <div className="font-jp text-2xl sm:text-3xl mb-6 leading-snug" style={{ fontWeight: 500 }}>
                {removeQNotation(current.jp)}
              </div>
              <div className="text-xs uppercase tracking-widest text-amber-700 mb-3">correct answer</div>
              <div className="font-display text-2xl sm:text-3xl leading-snug" style={{ fontWeight: 500 }}>
                {current.en}
              </div>
              {current.source && (
                <a
                  href={current.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stone-500 hover:text-amber-700 mt-6 inline-flex items-center gap-1 self-start"
                >
                  source <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <div className="font-mono text-stone-500 mt-4 text-sm">
                took {fmtMs(now - startTs)} {exceeded5sec && <span className="text-red-600">⚠ exceeded 10sec</span>}
              </div>
            </div>
            <div className="mt-8">
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-3 text-center">
                did you get it right?
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <button
                  onClick={() => handleRate('ok')}
                  className="px-8 py-3 rounded-full text-base font-medium inline-flex items-center gap-2 transition"
                  style={{
                    background: '#1c1917',
                    color: '#f5efe2',
                    border: '2px solid #1c1917',
                  }}
                >
                  <Check className="w-5 h-5" /> OK
                </button>
                <button
                  onClick={() => handleRate('ng')}
                  className="px-8 py-3 rounded-full text-base font-medium inline-flex items-center gap-2 transition border-2 border-stone-300 hover:border-stone-900"
                >
                  <X className="w-5 h-5" /> NG
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">{label}</div>
      <div className="font-display text-xl" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
