/**
 * Cloudflare Pages Function: Sessions API
 * GET /api/sessions - Get all sessions with attempts
 * POST /api/sessions - Create or update session with attempts
 */

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// GET: Fetch all sessions with attempts
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Get all sessions
    const sessions = await db.prepare(`
      SELECT * FROM sessions ORDER BY date DESC
    `).all();

    // For each session, get attempts
    const sessionsWithAttempts = [];
    for (const session of sessions.results) {
      const attempts = await db.prepare(`
        SELECT sentence_id as sentenceId, ms, result
        FROM attempts
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).bind(session.id).all();

      sessionsWithAttempts.push({
        id: session.id,
        date: session.date,
        attempts: attempts.results,
      });
    }

    return new Response(JSON.stringify(sessionsWithAttempts), {
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
