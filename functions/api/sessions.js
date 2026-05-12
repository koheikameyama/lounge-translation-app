/**
 * Cloudflare Pages Function: Sessions API
 * GET /api/sessions - Get all sessions with attempts
 * POST /api/sessions - Create or update session with attempts
 */

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// GET: Fetch all sessions with attempts in a single query
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    const rows = await db.prepare(`
      SELECT
        s.id   AS session_id,
        s.date AS session_date,
        a.sentence_id AS sentenceId,
        a.ms          AS ms,
        a.result      AS result
      FROM sessions s
      LEFT JOIN attempts a ON a.session_id = s.id
      ORDER BY s.date DESC, a.created_at ASC
    `).all();

    const sessionsById = new Map();
    for (const row of rows.results || []) {
      let session = sessionsById.get(row.session_id);
      if (!session) {
        session = { id: row.session_id, date: row.session_date, attempts: [] };
        sessionsById.set(row.session_id, session);
      }
      if (row.sentenceId != null) {
        session.attempts.push({
          sentenceId: row.sentenceId,
          ms: row.ms,
          result: row.result,
        });
      }
    }

    return new Response(JSON.stringify([...sessionsById.values()]), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST: Create or update session with attempts
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const { date, attempts } = body;

    if (!date || !attempts || !Array.isArray(attempts)) {
      return new Response(JSON.stringify({ error: 'Missing date or attempts' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if session for this date exists
    const existingSession = await db.prepare('SELECT id FROM sessions WHERE date = ?').bind(date).first();

    let sessionId;
    if (existingSession) {
      sessionId = existingSession.id;
    } else {
      // Create new session
      sessionId = generateId();
      await db.prepare('INSERT INTO sessions (id, date, created_at) VALUES (?, ?, ?)').bind(
        sessionId,
        date,
        Date.now()
      ).run();
    }

    // Insert attempts
    for (const attempt of attempts) {
      const attemptId = generateId();
      await db.prepare('INSERT INTO attempts (id, session_id, sentence_id, ms, result, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
        attemptId,
        sessionId,
        attempt.sentenceId,
        attempt.ms,
        attempt.result,
        Date.now()
      ).run();
    }

    return new Response(JSON.stringify({ id: sessionId, date, attempts }), {
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
