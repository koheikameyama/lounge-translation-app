/**
 * Cloudflare Pages Function: Videos API
 * GET /api/videos - Get all videos with stats
 */

// GET: Fetch all videos with aggregated stats
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Query to get all videos with stats
    // For each video, calculate:
    // - sentence_count: number of sentences from this video
    // - total_attempts: total practice attempts for sentences from this video
    // - got_count: count of "got" or "ok" results
    // - avg_time: average response time in milliseconds
    const query = db.prepare(`
      SELECT
        v.id,
        v.url,
        v.title,
        v.created_at,
        COUNT(DISTINCT s.id) as sentence_count,
        COUNT(a.id) as total_attempts,
        SUM(CASE WHEN a.result IN ('got', 'ok') THEN 1 ELSE 0 END) as got_count,
        COALESCE(AVG(a.ms), 0) as avg_time
      FROM videos v
      LEFT JOIN sentences s ON s.video_id = v.id
      LEFT JOIN attempts a ON a.sentence_id = s.id
      GROUP BY v.id, v.url, v.title, v.created_at
      ORDER BY v.created_at DESC
    `);

    const result = await query.all();

    // Format the results
    const videos = result.results.map(row => ({
      id: row.id,
      url: row.url,
      title: row.title,
      created_at: row.created_at,
      sentence_count: row.sentence_count,
      total_attempts: row.total_attempts,
      got_count: row.got_count,
      avg_time: Math.round(row.avg_time),
    }));

    return new Response(JSON.stringify(videos), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
