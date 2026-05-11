/**
 * Cloudflare Pages Function: Sync YouTube videos
 * POST /api/sync-videos - Fetch latest videos from channel and import to DB
 */

import {
  generateId,
  fetchChannelVideos,
  fetchSubtitles,
  pairSubtitles
} from '../_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const apiKey = env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'YouTube API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const {
      channelHandle = '@englishinthelounge',
      maxVideos = 5,
      skipExisting = true
    } = body;

    // Fetch latest videos from channel
    const videos = await fetchChannelVideos(channelHandle, apiKey, maxVideos);

    if (videos.length === 0) {
      return new Response(JSON.stringify({
        error: 'No videos found or channel not accessible',
        channelHandle
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = {
      channelHandle,
      totalVideos: videos.length,
      processed: [],
      skipped: [],
      errors: [],
    };

    // Process each video
    for (const video of videos) {
      try {
        // Check if video already exists
        if (skipExisting) {
          const existing = await db.prepare('SELECT id FROM videos WHERE url = ?')
            .bind(video.url)
            .first();

          if (existing) {
            results.skipped.push({
              videoId: video.videoId,
              title: video.title,
              reason: 'Already exists in database'
            });
            continue;
          }
        }

        // Fetch Japanese and English subtitles
        const [jaSubtitles, enSubtitles] = await Promise.all([
          fetchSubtitles(video.videoId, 'ja'),
          fetchSubtitles(video.videoId, 'en'),
        ]);

        if (!jaSubtitles || !enSubtitles) {
          results.errors.push({
            videoId: video.videoId,
            title: video.title,
            error: 'Subtitles not available (ja or en)'
          });
          continue;
        }

        // Pair Japanese and English subtitles
        const pairs = pairSubtitles(jaSubtitles, enSubtitles);

        if (pairs.length === 0) {
          results.errors.push({
            videoId: video.videoId,
            title: video.title,
            error: 'No sentence pairs could be generated'
          });
          continue;
        }

        // Create video entry
        const videoDbId = generateId();
        const now = Date.now();

        await db.prepare('INSERT INTO videos (id, url, title, created_at) VALUES (?, ?, ?, ?)')
          .bind(videoDbId, video.url, video.title, now)
          .run();

        // Insert sentences
        const sentenceIds = [];
        for (const pair of pairs) {
          const sentenceId = generateId();
          await db.prepare('INSERT INTO sentences (id, video_id, jp, en, created_at) VALUES (?, ?, ?, ?, ?)')
            .bind(sentenceId, videoDbId, pair.jp, pair.en, now)
            .run();
          sentenceIds.push(sentenceId);
        }

        results.processed.push({
          videoId: video.videoId,
          title: video.title,
          url: video.url,
          sentenceCount: pairs.length,
        });

      } catch (error) {
        results.errors.push({
          videoId: video.videoId,
          title: video.title,
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
