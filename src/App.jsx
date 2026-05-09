import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Plus, BarChart3, BookOpen, ChevronLeft, ChevronRight,
  Check, X, Minus, Trash2, Pencil, Clock, Flame, Target,
  ArrowRight, RotateCcw, Shuffle, Save, ExternalLink, Sparkles,
  Upload, FileJson
} from 'lucide-react';

const STORAGE_KEY = 'lounge-translation-app-v1';

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
`;

const SEED_SENTENCES = [
  { jp: 'ちょっとお腹すいた', en: "I'm a little hungry" },
  { jp: '今すぐ行くよ', en: "I'm coming right now" },
  { jp: 'それマジで?', en: 'Are you serious?' },
  { jp: 'やばい、忘れてた', en: 'Oh no, I forgot' },
  { jp: '今日めっちゃ疲れた', en: "I'm really tired today" },
  { jp: 'ちょっと待ってね', en: 'Hold on a sec' },
  { jp: '全然大丈夫だよ', en: "It's totally fine" },
  { jp: 'それいいね', en: 'That sounds good' },
  { jp: 'もう寝るわ', en: "I'm going to bed" },
  { jp: '今日は何する予定?', en: 'What are you up to today?' },
  { jp: 'それ知らなかった', en: "I didn't know that" },
  { jp: 'ありえない', en: 'No way' },
  { jp: '気にしないで', en: "Don't worry about it" },
  { jp: 'うまくいくといいね', en: 'I hope it goes well' },
  { jp: 'またね、気をつけて', en: 'See you, take care' },
];

// --------- helpers ----------
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateLabel(s) {
  const t = todayStr();
  const y = todayStr(new Date(Date.now() - 86400000));
  if (s === t) return 'Today';
  if (s === y) return 'Yesterday';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function emptyData() {
  return {
    sentences: SEED_SENTENCES.map((s) => ({
      id: uid(),
      jp: s.jp,
      en: s.en,
      source: '',
      createdAt: Date.now(),
    })),
    sessions: [], // { id, date, attempts: [{sentenceId, ms, result: 'got'|'close'|'miss'}] }
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Parse pasted import text. Supports:
//   - JSON array: [{jp, en, source?}]
//   - TSV: jp\ten\t[source] per line
//   - Alternating lines: jp / en / jp / en / ...
function parseImport(text) {
  text = text.trim();
  if (!text) return { pairs: [], format: null, error: null };

  // JSON
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const pairs = arr
        .filter((o) => o && o.jp && o.en)
        .map((o) => ({
          jp: String(o.jp).trim(),
          en: String(o.en).trim(),
          source: o.source ? String(o.source).trim() : '',
        }));
      return { pairs, format: 'json', error: null };
    } catch (e) {
      return { pairs: [], format: null, error: 'JSON parse error: ' + e.message };
    }
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // TSV
  if (lines.length > 0 && lines.every((l) => l.includes('\t'))) {
    const pairs = lines
      .map((l) => {
        const parts = l.split('\t');
        return {
          jp: (parts[0] || '').trim(),
          en: (parts[1] || '').trim(),
          source: (parts[2] || '').trim(),
        };
      })
      .filter((o) => o.jp && o.en);
    return { pairs, format: 'tsv', error: null };
  }

  // Alternating JP/EN lines
  const isJp = (s) => /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(s);
  const hasEn = (s) => /[A-Za-z]/.test(s);
  const isEn = (s) => hasEn(s) && !isJp(s);

  const pairs = [];
  let i = 0;
  while (i < lines.length - 1) {
    const a = lines[i];
    const b = lines[i + 1];
    if (isJp(a) && isEn(b)) {
      pairs.push({ jp: a, en: b, source: '' });
      i += 2;
    } else if (isEn(a) && isJp(b)) {
      pairs.push({ jp: b, en: a, source: '' });
      i += 2;
    } else {
      i++;
    }
  }
  return { pairs, format: pairs.length > 0 ? 'alternating' : null, error: null };
}

function fmtMs(ms) {
  if (ms == null) return '—';
  return (ms / 1000).toFixed(1) + 's';
}

function calcStreak(sessions) {
  const dates = new Set(sessions.map((s) => s.date));
  let streak = 0;
  let cursor = new Date();
  while (dates.has(todayStr(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

// --------- main ----------
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed.sentences && parsed.sessions) {
          setData(parsed);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      // first-time or parse fail — fall through to fresh
    }
    const fresh = emptyData();
    setData(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch (e) {
      console.error('localStorage write failed:', e);
    }
    setLoading(false);
  }, []);

  function persist(newData) {
    setData(newData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error('localStorage write failed:', e);
    }
  }

  function handleReset() {
    const fresh = emptyData();
    persist(fresh);
    setResetConfirm(false);
    setView('home');
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5efe2', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <style>{FONT_IMPORT}</style>
        <div className="text-stone-500 text-sm tracking-wide">loading…</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: '#f5efe2',
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        color: '#1c1917',
      }}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-jp { font-family: 'Noto Serif JP', serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .paper-grain {
          background-image: radial-gradient(circle at 1px 1px, rgba(28,25,23,0.04) 1px, transparent 0);
          background-size: 18px 18px;
        }
        .btn-amber {
          background: #1c1917;
          color: #f5efe2;
          transition: all 0.15s ease;
        }
        .btn-amber:hover { background: #b8843c; }
        .card {
          background: #fbf7ec;
          border: 1px solid rgba(28,25,23,0.08);
          box-shadow: 0 1px 0 rgba(28,25,23,0.02), 0 8px 24px -16px rgba(28,25,23,0.15);
        }
        .accent-line {
          background: linear-gradient(90deg, transparent, #b8843c, transparent);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: fadeIn 0.35s ease-out; }
      `}</style>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12 paper-grain min-h-screen">
        <Header view={view} setView={setView} sentenceCount={data.sentences.length} />

        <main className="mt-8 sm:mt-12">
          {view === 'home' && <HomeView data={data} setView={setView} />}
          {view === 'practice' && <PracticeView data={data} persist={persist} setView={setView} />}
          {view === 'sentences' && <SentencesView data={data} persist={persist} />}
          {view === 'history' && <HistoryView data={data} />}
        </main>

        <Footer onReset={() => setResetConfirm(true)} />
      </div>

      {resetConfirm && (
        <ResetModal onConfirm={handleReset} onCancel={() => setResetConfirm(false)} />
      )}
    </div>
  );
}

// --------- header ----------
function Header({ view, setView, sentenceCount }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'practice', label: 'Practice' },
    { id: 'sentences', label: 'Sentences' },
    { id: 'history', label: 'History' },
  ];
  return (
    <header>
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div
            className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-1"
            style={{ letterSpacing: '0.25em' }}
          >
            Daily Translation Log
          </div>
          <h1 className="font-display text-3xl sm:text-4xl" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
            English in the Lounge
            <span className="text-amber-700">.</span>
          </h1>
        </div>
        <div className="text-xs text-stone-500 font-mono">
          {sentenceCount} sentences
        </div>
      </div>
      <div className="accent-line h-px mt-6 mb-5" />
      <nav className="flex gap-1 sm:gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className="px-3 py-1.5 text-sm rounded-full transition"
            style={{
              background: view === t.id ? '#1c1917' : 'transparent',
              color: view === t.id ? '#f5efe2' : '#57534e',
              border: view === t.id ? '1px solid #1c1917' : '1px solid rgba(28,25,23,0.12)',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

// --------- home ----------
function HomeView({ data, setView }) {
  const todayKey = todayStr();
  const todaySession = data.sessions.find((s) => s.date === todayKey);

  const todayCount = todaySession ? todaySession.attempts.length : 0;
  const todayAvg =
    todaySession && todaySession.attempts.length
      ? todaySession.attempts.reduce((a, b) => a + b.ms, 0) / todaySession.attempts.length
      : null;
  const todayHit =
    todaySession && todaySession.attempts.length
      ? todaySession.attempts.filter((a) => a.result === 'got').length /
        todaySession.attempts.length
      : null;

  const streak = calcStreak(data.sessions);
  const totalAttempts = data.sessions.reduce((sum, s) => sum + s.attempts.length, 0);

  return (
    <div className="anim-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Stat
          icon={<Flame className="w-4 h-4" />}
          label="Streak"
          value={streak}
          unit="days"
          highlight={streak > 0}
        />
        <Stat
          icon={<Target className="w-4 h-4" />}
          label="Today"
          value={todayCount}
          unit="done"
        />
        <Stat
          icon={<Clock className="w-4 h-4" />}
          label="Avg time"
          value={todayAvg ? (todayAvg / 1000).toFixed(1) : '—'}
          unit={todayAvg ? 'sec' : ''}
        />
        <Stat
          icon={<BarChart3 className="w-4 h-4" />}
          label="Total"
          value={totalAttempts}
          unit="attempts"
        />
      </div>

      <div className="card rounded-2xl p-6 sm:p-10 mb-6">
        <div className="text-xs uppercase tracking-widest text-amber-700 mb-3">
          {todayCount > 0 ? 'continue' : 'begin'}
        </div>
        <h2 className="font-display text-2xl sm:text-3xl mb-2" style={{ fontWeight: 500 }}>
          {todayCount > 0
            ? `Nice. ${todayCount} done${todayHit != null ? `, ${Math.round(todayHit * 100)}% got it` : ''}.`
            : 'Ready for a session?'}
        </h2>
        <p className="text-stone-600 text-sm mb-6 max-w-prose">
          A Japanese sentence appears. Try to say the English version aloud (or in your head),
          then reveal the answer and rate yourself. Your time is recorded.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setView('practice')}
            className="btn-amber px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Start practice
          </button>
          <button
            onClick={() => setView('sentences')}
            className="px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 border border-stone-300 hover:border-stone-900 transition"
          >
            <Plus className="w-4 h-4" /> Add sentences
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard
          title="From the videos"
          body={
            <>
              Watch a video on{' '}
              <a
                href="https://www.youtube.com/@englishinthelounge/videos"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              >
                英語思考ラウンジ <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and add a phrase under <em>Sentences</em>. To bulk import, run{' '}
              <code className="font-mono text-xs bg-stone-200 px-1.5 py-0.5 rounded">fetch_transcript.py</code>{' '}
              locally on a video URL and paste the JSON into <em>Sentences → Bulk import</em>.
            </>
          }
        />
        <InfoCard
          title="How timing works"
          body={
            <>
              The timer starts the moment a Japanese sentence appears and stops when you reveal
              the answer. Be honest with the self-rating — your daily average and "got it" rate
              are the numbers worth watching over weeks.
            </>
          }
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, unit, highlight }) {
  return (
    <div
      className="rounded-xl p-3 sm:p-4"
      style={{
        background: highlight ? '#1c1917' : '#fbf7ec',
        color: highlight ? '#f5efe2' : '#1c1917',
        border: '1px solid rgba(28,25,23,0.08)',
      }}
    >
      <div
        className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-2"
        style={{ color: highlight ? '#d6a85f' : '#78716c' }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-display text-2xl sm:text-3xl flex items-baseline gap-1.5" style={{ fontWeight: 500 }}>
        {value}
        {unit && (
          <span className="text-xs font-sans uppercase tracking-wider" style={{ opacity: 0.6 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, body }) {
  return (
    <div className="card rounded-xl p-5">
      <div className="text-xs uppercase tracking-widest text-amber-700 mb-2">{title}</div>
      <div className="text-sm text-stone-700 leading-relaxed">{body}</div>
    </div>
  );
}

// --------- practice ----------
function PracticeView({ data, persist, setView }) {
  const [queue, setQueue] = useState(() => shuffle(data.sentences));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('ready'); // ready | timing | revealed | done
  const [startTs, setStartTs] = useState(null);
  const [now, setNow] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const intervalRef = useRef(null);
  const sessionSavedRef = useRef(false);

  // edge: no sentences
  if (data.sentences.length === 0) {
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

  // start timer when entering 'timing' phase
  useEffect(() => {
    if (phase === 'timing') {
      const t = Date.now();
      setStartTs(t);
      setNow(t);
      intervalRef.current = setInterval(() => setNow(Date.now()), 50);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, idx]);

  const current = queue[idx];

  function handleReveal() {
    if (phase === 'timing') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase('revealed');
    }
  }

  function handleRate(result) {
    const ms = Date.now() - startTs;
    const newAttempt = {
      sentenceId: current.id,
      ms,
      result, // 'got' | 'close' | 'miss'
    };
    const newAttempts = [...attempts, newAttempt];
    setAttempts(newAttempts);

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

  // save session when done
  useEffect(() => {
    if (phase === 'done' && attempts.length > 0 && !sessionSavedRef.current) {
      sessionSavedRef.current = true;
      const todayKey = todayStr();
      const existing = data.sessions.find((s) => s.date === todayKey);
      let newSessions;
      if (existing) {
        newSessions = data.sessions.map((s) =>
          s.date === todayKey ? { ...s, attempts: [...s.attempts, ...attempts] } : s
        );
      } else {
        newSessions = [
          ...data.sessions,
          { id: uid(), date: todayKey, attempts },
        ];
      }
      persist({ ...data, sessions: newSessions });
    }
  }, [phase, attempts, data, persist]);

  if (phase === 'done') {
    const total = attempts.length;
    const avg = attempts.reduce((a, b) => a + b.ms, 0) / Math.max(1, total);
    const got = attempts.filter((a) => a.result === 'got').length;
    return (
      <div className="card rounded-2xl p-10 text-center anim-in">
        <Sparkles className="w-7 h-7 mx-auto text-amber-600 mb-4" />
        <div className="text-xs uppercase tracking-widest text-amber-700 mb-2">Session complete</div>
        <h2 className="font-display text-3xl mb-6" style={{ fontWeight: 500 }}>
          {total} done.
        </h2>
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-8">
          <SmallStat label="Sentences" value={total} />
          <SmallStat label="Avg time" value={fmtMs(avg)} />
          <SmallStat label="Got it" value={`${Math.round((got / total) * 100)}%`} />
        </div>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setQueue(shuffle(data.sentences));
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
        <div className="font-mono text-stone-500">
          {idx + 1} <span className="text-stone-400">/ {queue.length}</span>
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
                translating
              </div>
              <div className="font-jp text-3xl sm:text-4xl leading-snug max-w-2xl" style={{ fontWeight: 500 }}>
                {current.jp}
              </div>
              <div className="font-mono text-stone-500 mt-10 text-sm">
                {fmtMs(now - startTs)}
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-6 flex-wrap">
              <button
                onClick={handleReveal}
                className="btn-amber px-6 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2"
              >
                Reveal answer <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2.5 rounded-full text-sm text-stone-500 hover:text-stone-900 transition"
              >
                skip
              </button>
            </div>
          </>
        )}

        {phase === 'revealed' && (
          <>
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">jp</div>
              <div className="font-jp text-2xl sm:text-3xl mb-8 leading-snug" style={{ fontWeight: 500 }}>
                {current.jp}
              </div>
              <div className="text-xs uppercase tracking-widest text-amber-700 mb-3">en</div>
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
              <div className="font-mono text-stone-500 mt-6 text-sm">
                took {fmtMs(now - startTs)}
              </div>
            </div>
            <div className="mt-8">
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-3 text-center">
                how did you do?
              </div>
              <div className="flex justify-center gap-2 flex-wrap">
                <RateBtn icon={<Check className="w-4 h-4" />} label="Got it" onClick={() => handleRate('got')} variant="dark" />
                <RateBtn icon={<Minus className="w-4 h-4" />} label="Close" onClick={() => handleRate('close')} />
                <RateBtn icon={<X className="w-4 h-4" />} label="Couldn't" onClick={() => handleRate('miss')} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RateBtn({ icon, label, onClick, variant }) {
  const dark = variant === 'dark';
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 transition"
      style={{
        background: dark ? '#1c1917' : 'transparent',
        color: dark ? '#f5efe2' : '#1c1917',
        border: '1px solid ' + (dark ? '#1c1917' : 'rgba(28,25,23,0.2)'),
      }}
      onMouseEnter={(e) => {
        if (!dark) e.currentTarget.style.borderColor = '#1c1917';
      }}
      onMouseLeave={(e) => {
        if (!dark) e.currentTarget.style.borderColor = 'rgba(28,25,23,0.2)';
      }}
    >
      {icon} {label}
    </button>
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

// --------- sentences ----------
function SentencesView({ data, persist }) {
  const [jp, setJp] = useState('');
  const [en, setEn] = useState('');
  const [source, setSource] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const importResult = useMemo(() => parseImport(importText), [importText]);

  function handleBulkImport() {
    if (importResult.pairs.length === 0) return;
    const newSentences = importResult.pairs.map((p) => ({
      id: uid(),
      jp: p.jp,
      en: p.en,
      source: p.source || '',
      createdAt: Date.now(),
    }));
    persist({ ...data, sentences: [...newSentences, ...data.sentences] });
    setImportText('');
    setShowImport(false);
  }

  function handleAddOrUpdate() {
    if (!jp.trim() || !en.trim()) return;
    if (editingId) {
      const updated = data.sentences.map((s) =>
        s.id === editingId ? { ...s, jp: jp.trim(), en: en.trim(), source: source.trim() } : s
      );
      persist({ ...data, sentences: updated });
      setEditingId(null);
    } else {
      const newSentence = {
        id: uid(),
        jp: jp.trim(),
        en: en.trim(),
        source: source.trim(),
        createdAt: Date.now(),
      };
      persist({ ...data, sentences: [newSentence, ...data.sentences] });
    }
    setJp('');
    setEn('');
    setSource('');
  }

  function handleDelete(id) {
    persist({ ...data, sentences: data.sentences.filter((s) => s.id !== id) });
    if (editingId === id) {
      setEditingId(null);
      setJp('');
      setEn('');
      setSource('');
    }
  }

  function handleEdit(s) {
    setEditingId(s.id);
    setJp(s.jp);
    setEn(s.en);
    setSource(s.source || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setJp('');
    setEn('');
    setSource('');
  }

  const filtered = filter
    ? data.sentences.filter(
        (s) =>
          s.jp.includes(filter) ||
          s.en.toLowerCase().includes(filter.toLowerCase())
      )
    : data.sentences;

  return (
    <div className="anim-in">
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setShowImport(!showImport)}
          className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-900 hover:bg-stone-100 transition"
        >
          <Upload className="w-3.5 h-3.5" />
          {showImport ? 'Hide import' : 'Bulk import'}
        </button>
      </div>

      {showImport && (
        <div className="card rounded-2xl p-6 mb-6 anim-in">
          <div className="text-xs uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-2">
            <FileJson className="w-3.5 h-3.5" />
            bulk import
          </div>
          <p className="text-sm text-stone-600 mb-3 leading-relaxed">
            Paste JSON output from <code className="font-mono text-xs bg-stone-200 px-1.5 py-0.5 rounded">fetch_transcript.py</code>,
            or paste raw transcript text with Japanese and English on alternating lines.
            Tab-separated values <code className="font-mono text-xs bg-stone-200 px-1.5 py-0.5 rounded">jp[TAB]en</code> also work.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`例:\n[\n  {"jp": "今行くよ", "en": "I'm coming", "source": "https://..."},\n  ...\n]`}
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-900 outline-none transition text-sm font-mono"
            style={{ resize: 'vertical' }}
          />

          {importResult.error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {importResult.error}
            </div>
          )}

          {importResult.pairs.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-stone-500 mb-2 flex items-center justify-between">
                <span>preview · {importResult.format} format</span>
                <span className="font-mono text-stone-400">
                  {importResult.pairs.length} {importResult.pairs.length === 1 ? 'pair' : 'pairs'}
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2 mb-4 border border-stone-200 rounded-lg p-3 bg-stone-50">
                {importResult.pairs.slice(0, 50).map((p, i) => (
                  <div key={i} className="text-sm flex items-baseline gap-3 py-1 border-b border-stone-200 last:border-0">
                    <span className="font-jp text-stone-800 flex-1 min-w-0">{p.jp}</span>
                    <span className="text-stone-400 text-xs">→</span>
                    <span className="font-display text-stone-700 flex-1 min-w-0">{p.en}</span>
                  </div>
                ))}
                {importResult.pairs.length > 50 && (
                  <div className="text-xs text-stone-500 italic pt-2">
                    …and {importResult.pairs.length - 50} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleBulkImport}
              disabled={importResult.pairs.length === 0}
              className="btn-amber px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add {importResult.pairs.length > 0 ? importResult.pairs.length : ''} sentence{importResult.pairs.length === 1 ? '' : 's'}
            </button>
            <button
              onClick={() => {
                setImportText('');
                setShowImport(false);
              }}
              className="px-5 py-2 rounded-full text-sm text-stone-500 hover:text-stone-900 transition"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      <div className="card rounded-2xl p-6 mb-6">
        <div className="text-xs uppercase tracking-widest text-amber-700 mb-3">
          {editingId ? 'edit sentence' : 'add a new sentence'}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-500 mb-1 block uppercase tracking-wider">Japanese</label>
            <input
              value={jp}
              onChange={(e) => setJp(e.target.value)}
              placeholder="例: 今日はめっちゃ疲れた"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-900 outline-none transition font-jp text-base"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block uppercase tracking-wider">English</label>
            <input
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="e.g., I'm really tired today"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-900 outline-none transition font-display text-base"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block uppercase tracking-wider">Source URL <span className="text-stone-400 normal-case">(optional)</span></label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-900 outline-none transition text-sm font-mono"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddOrUpdate}
              disabled={!jp.trim() || !en.trim()}
              className="btn-amber px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> {editingId ? 'Save changes' : 'Add sentence'}
            </button>
            {editingId && (
              <button
                onClick={cancelEdit}
                className="px-5 py-2 rounded-full text-sm text-stone-500 hover:text-stone-900 transition"
              >
                cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search…"
          className="px-3 py-1.5 text-sm rounded-full border border-stone-300 bg-transparent focus:bg-white focus:border-stone-900 outline-none transition w-full max-w-xs"
        />
        <div className="text-xs text-stone-500 font-mono whitespace-nowrap">
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="card rounded-xl p-4 flex items-start gap-3 group">
            <div className="flex-1 min-w-0">
              <div className="font-jp text-base mb-1">{s.jp}</div>
              <div className="font-display text-stone-700 text-sm">{s.en}</div>
              {s.source && (
                <a
                  href={s.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stone-400 hover:text-amber-700 mt-1 inline-flex items-center gap-1 truncate max-w-full"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{s.source}</span>
                </a>
              )}
            </div>
            <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition flex-shrink-0">
              <button
                onClick={() => handleEdit(s)}
                className="p-1.5 rounded-md hover:bg-stone-200 transition"
                aria-label="edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1.5 rounded-md hover:bg-red-100 hover:text-red-700 transition"
                aria-label="delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-stone-500 py-12">
            {filter ? 'No matches.' : 'No sentences yet.'}
          </div>
        )}
      </div>
    </div>
  );
}

// --------- history ----------
function HistoryView({ data }) {
  const sortedSessions = useMemo(
    () => [...data.sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [data.sessions]
  );

  if (sortedSessions.length === 0) {
    return (
      <div className="card rounded-2xl p-10 text-center anim-in">
        <BarChart3 className="w-7 h-7 mx-auto text-stone-400 mb-3" />
        <h2 className="font-display text-xl mb-2" style={{ fontWeight: 500 }}>
          No sessions yet
        </h2>
        <p className="text-stone-500 text-sm">
          Once you complete a practice session, your history will appear here.
        </p>
      </div>
    );
  }

  // overall stats
  const totalAttempts = sortedSessions.reduce((a, s) => a + s.attempts.length, 0);
  const allMs = sortedSessions.flatMap((s) => s.attempts.map((a) => a.ms));
  const overallAvg = allMs.length ? allMs.reduce((a, b) => a + b, 0) / allMs.length : 0;
  const overallGot =
    totalAttempts > 0
      ? sortedSessions.flatMap((s) => s.attempts).filter((a) => a.result === 'got').length /
        totalAttempts
      : 0;

  // sparkline data: last 14 days
  const last14 = useMemo(() => {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = todayStr(d);
      const sess = sortedSessions.find((s) => s.date === key);
      const count = sess ? sess.attempts.length : 0;
      const avg =
        sess && sess.attempts.length
          ? sess.attempts.reduce((a, b) => a + b.ms, 0) / sess.attempts.length
          : null;
      out.push({ key, count, avg });
    }
    return out;
  }, [sortedSessions]);

  const maxCount = Math.max(1, ...last14.map((d) => d.count));

  return (
    <div className="anim-in">
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SmallCard label="Sessions" value={sortedSessions.length} />
        <SmallCard label="Avg time" value={fmtMs(overallAvg)} />
        <SmallCard label="Got it" value={`${Math.round(overallGot * 100)}%`} />
      </div>

      <div className="card rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-widest text-amber-700">Last 14 days</div>
          <div className="text-xs text-stone-500 font-mono">attempts/day</div>
        </div>
        <div className="flex items-end gap-1 h-24">
          {last14.map((d, i) => (
            <div key={d.key} className="flex-1 flex flex-col items-center justify-end group relative">
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${(d.count / maxCount) * 100}%`,
                  minHeight: d.count > 0 ? '4px' : '1px',
                  background: d.count > 0 ? '#b8843c' : 'rgba(28,25,23,0.08)',
                  opacity: d.count > 0 ? 1 : 0.3,
                }}
              />
              {d.count > 0 && (
                <div className="absolute -top-7 text-xs font-mono bg-stone-900 text-stone-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  {d.count} • {fmtMs(d.avg)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-stone-400 font-mono mt-2">
          <span>14d ago</span>
          <span>today</span>
        </div>
      </div>

      <div className="text-xs uppercase tracking-widest text-stone-500 mb-3 px-1">All sessions</div>
      <div className="space-y-2">
        {sortedSessions.map((s) => {
          const total = s.attempts.length;
          const avg = s.attempts.reduce((a, b) => a + b.ms, 0) / total;
          const got = s.attempts.filter((a) => a.result === 'got').length;
          const close = s.attempts.filter((a) => a.result === 'close').length;
          const miss = s.attempts.filter((a) => a.result === 'miss').length;
          return (
            <div key={s.id} className="card rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                <div className="font-display text-lg" style={{ fontWeight: 500 }}>
                  {dateLabel(s.date)}
                </div>
                <div className="text-xs text-stone-400 font-mono">{s.date}</div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
                <span><span className="text-stone-400">total</span> {total}</span>
                <span><span className="text-stone-400">avg</span> {fmtMs(avg)}</span>
                <span className="text-stone-700">
                  <span className="text-emerald-700">●</span> {got}
                  <span className="text-amber-600 ml-2">●</span> {close}
                  <span className="text-stone-400 ml-2">●</span> {miss}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmallCard({ label, value }) {
  return (
    <div className="card rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">{label}</div>
      <div className="font-display text-2xl" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// --------- footer ----------
function Footer({ onReset }) {
  return (
    <footer className="mt-16 pt-6 border-t border-stone-200 flex items-center justify-between text-xs text-stone-400">
      <div className="font-mono">data saved locally · in your browser</div>
      <button onClick={onReset} className="hover:text-red-600 transition">
        reset all data
      </button>
    </footer>
  );
}

function ResetModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.5)' }}>
      <div className="card rounded-2xl p-6 max-w-sm w-full">
        <h3 className="font-display text-xl mb-2" style={{ fontWeight: 500 }}>Reset everything?</h3>
        <p className="text-sm text-stone-600 mb-5">
          This will delete all your custom sentences and history, and restore the starter set.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm hover:bg-stone-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full text-sm bg-red-600 text-white hover:bg-red-700 transition"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
