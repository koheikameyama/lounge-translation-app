import { useState, useEffect } from 'react';
import { sentencesAPI, sessionsAPI, videosAPI, migrateFromLocalStorage } from './api';
import { STORAGE_KEY, FONT_IMPORT, SEED_SENTENCES } from './constants';
import { uid } from './utils/helpers';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { PracticeView } from './components/PracticeView';
import { SentencesView } from './components/SentencesView';
import { VideosView } from './components/VideosView';
import { HistoryView } from './components/HistoryView';
import { Footer, ResetModal } from './components/Footer';

export default function App() {
  const [sentences, setSentences] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null); // 'checking' | 'migrating' | 'done' | null

  // Refresh data from D1 when switching to practice or sentences view
  useEffect(() => {
    if (view === 'practice' || view === 'sentences') {
      sentencesAPI.getAll().then(setSentences).catch(err => {
        console.error('Failed to refresh sentences:', err);
      });
    }
  }, [view]);

  // Load data from D1
  useEffect(() => {
    async function loadData() {
      try {
        // Check if localStorage has data that needs migration
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed.sentences && parsed.sentences.length > 0) {
            setMigrationStatus('checking');
            const shouldMigrate = window.confirm(
              `Found ${parsed.sentences.length} sentences in localStorage. ` +
              `Migrate to cloud database? This will sync your data across devices.`
            );

            if (shouldMigrate) {
              setMigrationStatus('migrating');
              const result = await migrateFromLocalStorage(parsed);
              if (result.success) {
                alert('Migration complete! Your data is now synced to the cloud.');
                localStorage.removeItem(STORAGE_KEY);
              } else {
                alert('Migration failed: ' + result.error);
                setMigrationStatus(null);
                setLoading(false);
                return;
              }
            } else {
              setSentences(parsed.sentences || []);
              setSessions(parsed.sessions || []);
              setMigrationStatus('done');
              setLoading(false);
              return;
            }
          }
        }

        const [sentencesData, sessionsData, videosData] = await Promise.all([
          sentencesAPI.getAll(),
          sessionsAPI.getAll(),
          videosAPI.getAll(),
        ]);

        setSentences(sentencesData || []);
        setSessions(sessionsData || []);
        setVideos(videosData || []);
        setMigrationStatus('done');
      } catch (error) {
        console.error('Failed to load data:', error);
        // Fallback to seed data if D1 fails
        const seedData = SEED_SENTENCES.map((s) => ({
          id: uid(),
          jp: s.jp,
          en: s.en,
          source: '',
          createdAt: Date.now(),
        }));
        setSentences(seedData);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  async function handleReset() {
    if (!window.confirm('Are you sure? This will delete ALL data including videos, sentences, and history.')) {
      setResetConfirm(false);
      return;
    }

    try {
      for (const sentence of sentences) {
        await sentencesAPI.delete(sentence.id);
      }

      const seedData = SEED_SENTENCES.map((s) => ({
        jp: s.jp,
        en: s.en,
        source: '',
      }));
      await sentencesAPI.create(seedData);

      const [newSentences, newSessions, newVideos] = await Promise.all([
        sentencesAPI.getAll(),
        sessionsAPI.getAll(),
        videosAPI.getAll(),
      ]);

      setSentences(newSentences);
      setSessions(newSessions);
      setVideos(newVideos);
      setResetConfirm(false);
      setView('home');
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Reset failed: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5efe2', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <style>{FONT_IMPORT}</style>
        <div className="text-stone-500 text-sm tracking-wide">
          {migrationStatus === 'migrating' ? 'Migrating data to cloud...' : 'loading…'}
        </div>
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
        <Header view={view} setView={setView} sentenceCount={sentences.length} />

        <main className="mt-8 sm:mt-12">
          {view === 'home' && <HomeView sessions={sessions} sentences={sentences} setView={setView} />}
          {view === 'practice' && <PracticeView sentences={sentences} sessions={sessions} setSessions={setSessions} setView={setView} />}
          {view === 'sentences' && <SentencesView sentences={sentences} setSentences={setSentences} />}
          {view === 'videos' && <VideosView videos={videos} sentences={sentences} setView={setView} />}
          {view === 'history' && <HistoryView sessions={sessions} />}
        </main>

        <Footer onReset={() => setResetConfirm(true)} />
      </div>

      {resetConfirm && (
        <ResetModal onConfirm={handleReset} onCancel={() => setResetConfirm(false)} />
      )}
    </div>
  );
}
