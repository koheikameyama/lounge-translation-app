/**
 * Cloudflare Pages Function: Sentences API
 * GET /api/sentences - Get all sentences (optionally filter by video_id)
 * POST /api/sentences - Create new sentence(s)
 * PUT /api/sentences - Update sentence
 * DELETE /api/sentences - Delete sentence
 */

import { fetchVideoTitle } from '../_shared.js';

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// GET: Fetch all sentences
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const videoId = url.searchParams.get('video_id');

  try {
    let query;
    if (videoId) {
      query = db.prepare(`
        SELECT s.*, v.url as video_url, v.title as video_title
        FROM sentences s
        LEFT JOIN videos v ON s.video_id = v.id
        WHERE s.video_id = ?
        ORDER BY s.created_at DESC
      `).bind(videoId);
    } else {
      query = db.prepare(`
        SELECT s.*, v.url as video_url, v.title as video_title
        FROM sentences s
        LEFT JOIN videos v ON s.video_id = v.id
        ORDER BY s.created_at DESC
      `);
    }

    const result = await query.all();
    return new Response(JSON.stringify(result.results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST: Create new sentence(s)
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const sentences = Array.isArray(body) ? body : [body];

    // Process each sentence
    const results = [];
    for (const sentence of sentences) {
      const { jp, en, source } = sentence;

      if (!jp || !en) {
        return new Response(JSON.stringify({ error: 'Missing jp or en field' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sentenceId = generateId();
      const createdAt = Date.now();
      let videoId = null;

      // If source is provided, create or get video
      if (source) {
        // Check if video exists
        const existingVideo = await db.prepare('SELECT id FROM videos WHERE url = ?').bind(source).first();

        if (existingVideo) {
          videoId = existingVideo.id;
        } else {
          // Create new video entry
          videoId = generateId();

          // Fetch video title from YouTube API
          const title = await fetchVideoTitle(source, env.YOUTUBE_API_KEY);

          await db.prepare('INSERT INTO videos (id, url, title, created_at) VALUES (?, ?, ?, ?)').bind(
            videoId,
            source,
            title,
            createdAt
          ).run();
        }
      }

      // Insert sentence
      await db.prepare('INSERT INTO sentences (id, video_id, source, jp, en, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
        sentenceId,
        videoId,
        source,
        jp,
        en,
        createdAt
      ).run();

      results.push({ id: sentenceId, jp, en, source, videoId, createdAt });
    }

    return new Response(JSON.stringify(results), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PUT: Update sentence
export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const { id, jp, en, source } = body;

    if (!id || !jp || !en) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle video if source changed
    let videoId = null;
    if (source) {
      const existingVideo = await db.prepare('SELECT id FROM videos WHERE url = ?').bind(source).first();
      if (existingVideo) {
        videoId = existingVideo.id;
      } else {
        videoId = generateId();

        // Fetch video title from YouTube API
        const title = await fetchVideoTitle(source, env.YOUTUBE_API_KEY);

        await db.prepare('INSERT INTO videos (id, url, title, created_at) VALUES (?, ?, ?, ?)').bind(
          videoId,
          source,
          title,
          Date.now()
        ).run();
      }
    }

    // Update sentence
    await db.prepare('UPDATE sentences SET jp = ?, en = ?, video_id = ?, source = ? WHERE id = ?').bind(
      jp,
      en,
      videoId,
      source,
      id
    ).run();

    return new Response(JSON.stringify({ id, jp, en, source, videoId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE: Delete sentence
export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Delete associated attempts first
    await db.prepare('DELETE FROM attempts WHERE sentence_id = ?').bind(id).run();

    // Delete sentence
    await db.prepare('DELETE FROM sentences WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
