// Cloudflare Worker: the website's AI assistant.
// POST /chat { messages: [{ role, content }], lang } -> { answer, factors, model }
// Runs an open model on Workers AI. Keeps no logs of questions.
import { parseBody, pickFactors, systemPrompt, cleanAnswer } from './lib.mjs';

let cache = { at: 0, data: null };
const hits = new Map(); // best-effort per-IP limit within one isolate

async function loadData(env) {
  if (cache.data && Date.now() - cache.at < 3600_000) return cache.data;
  const res = await fetch(env.DATA_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`data ${res.status}`);
  cache = { at: Date.now(), data: await res.json() };
  return cache.data;
}

function cors(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : allowed[0] ?? '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function limited(ip, perMinute) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > perMinute;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { ok, headers } = cors(request.headers.get('Origin') ?? '', env);
    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers });
    if (url.pathname === '/health') return json({ ok: true }, 200, headers);
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, headers);
    if (!ok) return json({ error: 'origin not allowed' }, 403, headers);
    if (limited(request.headers.get('CF-Connecting-IP') ?? 'x', Number(env.PER_MINUTE ?? 8))) return json({ error: 'rate', message: 'too many questions, try again in a minute' }, 429, headers);

    let input;
    try { input = parseBody(await request.json()); } catch (e) { return json({ error: 'bad request', message: e.message }, 400, headers); }

    let data;
    try { data = await loadData(env); } catch { return json({ error: 'data unavailable' }, 502, headers); }

    const convo = input.messages.map((m) => m.content).join('\n');
    const factors = pickFactors(data.factors, convo);
    const messages = [{ role: 'system', content: systemPrompt({ lang: input.lang, factors, inventory: data.inventory }) }, ...input.messages];

    const models = String(env.MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    let lastErr = '';
    for (const model of models) {
      try {
        const out = await env.AI.run(model, { messages, max_tokens: 700, temperature: 0.2 });
        const answer = cleanAnswer(out?.response ?? out?.result?.response ?? (typeof out === 'string' ? out : ''));
        if (answer) return json({ answer, factors: factors.map((f) => f.id), model }, 200, headers);
        lastErr = 'empty answer';
      } catch (e) {
        lastErr = String(e?.message ?? e);
        if (/neuron|quota|limit|4006|exceeded/i.test(lastErr)) return json({ error: 'quota', message: 'daily free allowance used up' }, 503, headers);
      }
    }
    return json({ error: 'model', message: lastErr.slice(0, 200) }, 502, headers);
  },
};
