import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { dateLabel, fmtMs, todayStr } from '../utils/helpers';

export function HistoryView({ sessions }) {
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [sessions]
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

  const totalAttempts = sortedSessions.reduce((a, s) => a + s.attempts.length, 0);
  const allMs = sortedSessions.flatMap((s) => s.attempts.map((a) => a.ms));
  const overallAvg = allMs.length ? allMs.reduce((a, b) => a + b, 0) / allMs.length : 0;
  const overallGot =
    totalAttempts > 0
      ? sortedSessions.flatMap((s) => s.attempts).filter((a) => a.result === 'got').length /
        totalAttempts
      : 0;

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
