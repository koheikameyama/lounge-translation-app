import {
  Play, Plus, BarChart3, Clock, Flame, Target, ExternalLink,
} from 'lucide-react';
import { calcStreak, todayStr } from '../utils/helpers';

export function HomeView({ sessions, sentences, setView }) {
  const todayKey = todayStr();
  const todaySession = sessions.find((s) => s.date === todayKey);

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

  const streak = calcStreak(sessions);
  const totalAttempts = sessions.reduce((sum, s) => sum + s.attempts.length, 0);

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
          A Japanese sentence appears. Speak the English version aloud within 5 seconds,
          then compare your answer with the correct one. Rate yourself as OK or NG.
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
