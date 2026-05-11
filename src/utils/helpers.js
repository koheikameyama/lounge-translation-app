export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateLabel(s) {
  const t = todayStr();
  const y = todayStr(new Date(Date.now() - 86400000));
  if (s === t) return 'Today';
  if (s === y) return 'Yesterday';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Remove Q○○ patterns from Japanese text (Q01, Q001, Q１, Q○○, Q〇〇, etc.)
export function removeQNotation(text) {
  return text.replace(/^[Qq][0-9０-９○◯〇]+[\s:：]*/, '');
}

// Prioritized shuffle: no-history → NG → time-exceeded → others (each shuffled within group)
export function weightedShuffle(sentences, sessions) {
  if (!sessions || sessions.length === 0) {
    return shuffle(sentences);
  }

  const stats = {};
  sentences.forEach(s => {
    stats[s.id] = { ok: 0, ng: 0, total: 0, times: [] };
  });

  sessions.forEach(session => {
    session.attempts.forEach(attempt => {
      if (stats[attempt.sentenceId]) {
        stats[attempt.sentenceId].total++;
        if (attempt.result === 'ok' || attempt.result === 'got') {
          stats[attempt.sentenceId].ok++;
        } else {
          stats[attempt.sentenceId].ng++;
        }
        stats[attempt.sentenceId].times.push(attempt.ms);
      }
    });
  });

  const TARGET_TIME = 10000;

  const noHistory = [];
  const hasNG = [];
  const timeExceeded = [];
  const others = [];

  sentences.forEach(s => {
    const stat = stats[s.id];
    if (stat.total === 0) {
      noHistory.push(s);
    } else if (stat.ng > 0) {
      hasNG.push(s);
    } else {
      const avgTime = stat.times.reduce((a, b) => a + b, 0) / stat.times.length;
      if (avgTime > TARGET_TIME) {
        timeExceeded.push(s);
      } else {
        others.push(s);
      }
    }
  });

  return [
    ...shuffle(noHistory),
    ...shuffle(hasNG),
    ...shuffle(timeExceeded),
    ...shuffle(others),
  ];
}

// Parse pasted import text (JSON / TSV / alternating JP/EN lines)
export function parseImport(text) {
  text = text.trim();
  if (!text) return { pairs: [], format: null, error: null };

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

  const isJp = (s) => /[぀-ゟ゠-ヿ一-鿿]/.test(s);
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

export function fmtMs(ms) {
  if (ms == null) return '—';
  return (ms / 1000).toFixed(1) + 's';
}

export function calcStreak(sessions) {
  const dates = new Set(sessions.map((s) => s.date));
  let streak = 0;
  let cursor = new Date();
  while (dates.has(todayStr(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}
