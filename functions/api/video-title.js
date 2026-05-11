/**
 * Cloudflare Pages Function: Get YouTube video title
 * GET /api/video-title?url=https://www.youtube.com/watch?v=...
 */

import { extractVideoId, fetchVideoTitle } from '../_shared.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract video ID from URL
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch video title from YouTube Data API
  try {
    if (!env.YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: 'YouTube API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const title = await fetchVideoTitle(videoUrl, env.YOUTUBE_API_KEY);

    if (title) {
      return new Response(JSON.stringify({ title, videoId }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
