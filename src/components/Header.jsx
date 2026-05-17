export function Header({ view, setView, sentenceCount }) {
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
