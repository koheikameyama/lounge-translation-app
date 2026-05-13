/**
 * Cloudflare Pages Function: Feedback API
 * POST /api/feedback - Compare user's answer to correct answer and return a short grammar comment
 *
 * Request body: { jp: string, userAnswer: string, correctAnswer: string }
 * Response: { comment: string }
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { jp, userAnswer, correctAnswer } = body || {};
  if (!jp || !correctAnswer) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt =
    'あなたは英作文の添削者です。日本語、ユーザー回答、模範解答を見て、' +
    '時制・活用・表現の観点から1文だけ日本語でコメントしてください。' +
    'ユーザー回答が空または聞き取れていない場合は、模範解答の文法ポイントを1文で説明してください。' +
    'コメントは50字以内、敬体不要、絵文字不要。';

  const userPrompt =
    `日本語: ${jp}\n` +
    `ユーザー回答: ${userAnswer || '(回答なし)'}\n` +
    `模範解答: ${correctAnswer}`;

  try {
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 120,
      }),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      return new Response(JSON.stringify({ error: `OpenAI HTTP ${openaiResp.status}: ${errText.slice(0, 200)}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await openaiResp.json();
    const comment = data?.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ comment }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
