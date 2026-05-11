import { Play, ExternalLink, Video } from 'lucide-react';
import { fmtMs } from '../utils/helpers';

export function VideosView({ videos, sentences, setView }) {
  if (videos.length === 0) {
    return (
      <div className="card rounded-2xl p-10 text-center anim-in">
        <Video className="w-7 h-7 mx-auto text-stone-400 mb-3" />
        <h2 className="font-display text-xl mb-2" style={{ fontWeight: 500 }}>
          No videos yet
        </h2>
        <p className="text-stone-500 text-sm">
          Import sentences from videos to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="anim-in">
      <div className="text-xs uppercase tracking-widest text-stone-500 mb-4 px-1">
        {videos.length} {videos.length === 1 ? 'video' : 'videos'}
      </div>

      <div className="space-y-3">
        {videos.map((video) => {
          const gotRate = video.total_attempts > 0
            ? (video.got_count / video.total_attempts) * 100
            : null;

          return (
            <div key={video.id} className="card rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg mb-1" style={{ fontWeight: 500 }}>
                    {video.title || 'Untitled Video'}
                  </h3>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-400 hover:text-amber-700 inline-flex items-center gap-1 truncate"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{video.url}</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Sentences</div>
                  <div className="font-display text-xl" style={{ fontWeight: 500 }}>
                    {video.sentence_count}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Practice</div>
                  <div className="font-display text-xl" style={{ fontWeight: 500 }}>
                    {video.total_attempts || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Avg time</div>
                  <div className="font-display text-xl" style={{ fontWeight: 500 }}>
                    {fmtMs(video.avg_time)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Got it</div>
                  <div className="font-display text-xl" style={{ fontWeight: 500 }}>
                    {gotRate !== null ? `${Math.round(gotRate)}%` : '—'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // TODO: Implement practice mode with video filter
                    alert('Practice mode for specific video - coming soon!');
                  }}
                  className="btn-amber px-4 py-2 rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Practice this video
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
