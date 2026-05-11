import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, RotateCcw, Save, ExternalLink,
  Upload, FileJson,
} from 'lucide-react';
import { sentencesAPI } from '../api';
import { parseImport, removeQNotation } from '../utils/helpers';

export function SentencesView({ sentences, setSentences }) {
  const [jp, setJp] = useState('');
  const [en, setEn] = useState('');
  const [source, setSource] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const importResult = useMemo(() => parseImport(importText), [importText]);

  async function handleBulkImport() {
    if (importResult.pairs.length === 0) return;
    try {
      await sentencesAPI.create(importResult.pairs);
      const newSentences = await sentencesAPI.getAll();
      setSentences(newSentences);
      setImportText('');
      setShowImport(false);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed: ' + error.message);
    }
  }

  async function handleAddOrUpdate() {
    if (!jp.trim() || !en.trim()) return;
    try {
      if (editingId) {
        await sentencesAPI.update({
          id: editingId,
          jp: jp.trim(),
          en: en.trim(),
          source: source.trim(),
        });
        setEditingId(null);
      } else {
        await sentencesAPI.create([{
          jp: jp.trim(),
          en: en.trim(),
          source: source.trim(),
        }]);
      }
      const newSentences = await sentencesAPI.getAll();
      setSentences(newSentences);
      setJp('');
      setEn('');
      setSource('');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Save failed: ' + error.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this sentence?')) return;
    try {
      await sentencesAPI.delete(id);
      const newSentences = await sentencesAPI.getAll();
      setSentences(newSentences);
      if (editingId === id) {
        setEditingId(null);
        setJp('');
        setEn('');
        setSource('');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed: ' + error.message);
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

  async function handleSyncFromD1() {
    if (!window.confirm('Sync latest sentences from D1 database?')) return;
    try {
      const newSentences = await sentencesAPI.getAll();
      setSentences(newSentences);
      alert(`Successfully synced ${newSentences.length} sentences from D1!`);
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed: ' + error.message);
    }
  }

  const filtered = filter
    ? sentences.filter(
        (s) =>
          s.jp.includes(filter) ||
          s.en.toLowerCase().includes(filter.toLowerCase())
      )
    : sentences;

  return (
    <div className="anim-in">
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          onClick={handleSyncFromD1}
          className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-amber-300 text-amber-800 hover:border-amber-600 hover:bg-amber-50 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Sync from D1
        </button>
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
            {s.number != null && (
              <div className="text-xs font-mono text-stone-400 mt-1 min-w-12">
                #{s.number}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-jp text-base mb-1">{removeQNotation(s.jp)}</div>
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
