/**
 * Cloudflare Pages Function: Videos API
 * GET /api/videos - Get all videos with stats
 */

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Get all videos with sentence count and attempt stats
    const videos = await db.prepare(`
      SELECT
        v.id,
        v.url,
        v.title,
        v.created_at,
        COUNT(DISTINCT s.id) as sentence_count,
        COUNT(a.id) as total_attempts,
        SUM(CASE WHEN a.result = 'got' THEN 1 ELSE 0 END) as got_count,
        AVG(a.ms) as avg_time
      FROM videos v
      LEFT JOIN sentences s ON s.video_id = v.id
      LEFT JOIN attempts a ON a.sentence_id = s.id
      GROUP BY v.id, v.url, v.title, v.created_at
      ORDER BY v.created_at DESC
    `).all();

    return new Response(JSON.stringify(videos.results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
