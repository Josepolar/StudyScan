// Server-only provider adapter. Never import this module from client components.
export type AIEnvironment = { AI_PROVIDER?: string; OLLAMA_MODEL?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string; GROQ_API_KEY?: string; GROQ_MODEL?: string };
export const aiInfo = (env: AIEnvironment) => {
  const provider = env.AI_PROVIDER?.trim() || 'openai';
  if (provider === 'ollama') return { ready: true, model: env.OLLAMA_MODEL?.trim() || 'qwen3:0.6b', provider: 'Ollama (local)' };
  if (provider === 'groq') return { ready: !!env.GROQ_API_KEY?.trim(), model: env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b', provider: 'Groq' };
  return { ready: provider === 'openai' && !!env.OPENAI_API_KEY?.trim(), model: env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini', provider: 'OpenAI' };
};

export async function aiAvailable(env: AIEnvironment) {
  const info = aiInfo(env);
  if (info.provider !== 'Ollama (local)') return info.ready;
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const body = await response.json() as { models?: { name: string }[] };
    return !!body.models?.some(m => m.name === info.model);
  } catch { return false; }
}

export async function generateAnswer(
  env: AIEnvironment,
  instructions: string,
  data: { sources: { index: number; text: string }[]; history: { question: string; answer: string }[]; question: string },
  transport: typeof fetch = fetch,
): Promise<{ answer: string; status: 'answered' | 'needs-teacher'; citations: number[] }> {
  const info = aiInfo(env);
  if (!info.ready) throw new Error('AI_NOT_CONFIGURED');
  if (info.provider === 'Ollama (local)') {
    const result = await transport('http://127.0.0.1:11434/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ model: info.model, stream: false, think: false, keep_alive: '5m',
        messages: [{ role: 'system', content: instructions + ' Use age-appropriate language. Do not ask for personal information. Return only the requested JSON.' }, { role: 'user', content: JSON.stringify(data) }],
        options: { temperature: 0.2, num_predict: 700, num_ctx: 4096 },
        format: { type: 'object', properties: { answer: { type: 'string' }, status: { type: 'string', enum: ['answered', 'needs-teacher'] }, citations: { type: 'array', items: { type: 'integer' } } }, required: ['answer', 'status', 'citations'], additionalProperties: false },
      }),
    });
    if (!result.ok) throw new Error('AI_UNAVAILABLE');
    const raw = await result.json() as { done?: boolean; done_reason?: string; message?: { content?: string } };
    if (!raw.done || raw.done_reason !== 'stop' || !raw.message?.content) throw new Error('AI_INVALID_RESPONSE');
    return validateAnswer(JSON.parse(raw.message.content), data.sources.length);
  }
  const isOpenAI = info.provider === 'OpenAI';
  const endpoint = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
  const apiKey = isOpenAI ? env.OPENAI_API_KEY : env.GROQ_API_KEY;
  const result = await transport(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey!.trim()}` },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: info.model,
      ...(isOpenAI ? { store: false } : {}),
      messages: [
        { role: 'system', content: instructions + ' Use age-appropriate educational language. Do not request identifying or sensitive student information. Never give harmful instructions; refer safety concerns to a trusted adult.' },
        { role: 'user', content: JSON.stringify(data) },
      ],
      temperature: 0.2,
      max_completion_tokens: 2048,
      response_format: { type: 'json_schema', json_schema: {
        name: 'study_answer', strict: true, schema: {
          type: 'object', additionalProperties: false,
          properties: {
            answer: { type: 'string' },
            status: { type: 'string', enum: ['answered', 'needs-teacher'] },
            citations: { type: 'array', items: { type: 'integer' } },
          }, required: ['answer', 'status', 'citations'],
        },
      } },
    }),
  });
  // Never log provider bodies or request headers: they can contain private data.
  if (!result.ok) throw new Error(result.status === 429 ? 'AI_RATE_LIMITED' : 'AI_UNAVAILABLE');
  const body = await result.json() as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
  const choice = body.choices?.[0];
  if (choice?.finish_reason !== 'stop' || !choice.message?.content) throw new Error('AI_INVALID_RESPONSE');
  return validateAnswer(JSON.parse(choice.message.content), data.sources.length);
}

function validateAnswer(answer: any, sourceCount: number): { answer: string; status: 'answered' | 'needs-teacher'; citations: number[] } {
  if (!answer || typeof answer.answer !== 'string' || !answer.answer.trim() ||
      !['answered', 'needs-teacher'].includes(answer.status) || !Array.isArray(answer.citations) ||
      answer.citations.some((n: unknown) => !Number.isInteger(n) || Number(n) < 1 || Number(n) > sourceCount) ||
      (answer.status === 'answered' && answer.citations.length === 0)) throw new Error('AI_INVALID_RESPONSE');
  return { answer: answer.answer.slice(0, 6000), status: answer.status, citations: [...new Set<number>(answer.citations)] };
}
