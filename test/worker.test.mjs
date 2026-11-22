import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBody, pickFactors, systemPrompt, cleanAnswer } from '../worker/src/lib.mjs';
import worker from '../worker/src/index.mjs';

const F = (id, category, year, extra = {}) => ({ id, category, year, status: 'reviewed', value: 0.5, unit: 'kgCO2e/kWh', region: 'HK', gas: 'CO2e', quality: 'B', name: { 'zh-Hant': id, en: id }, source: { id: 'src-x' }, ...extra });
const factors = [
  F('hk.energy.electricity.clp.2024', 'energy/electricity', 2024, { region: 'HK-CLP' }),
  F('hk.energy.electricity.clp.2025', 'energy/electricity', 2025, { region: 'HK-CLP' }),
  F('hk.energy.electricity.hke.2025', 'energy/electricity', 2025, { region: 'HK-HKE' }),
  F('hk.energy.electricity.hke.2005-emsd2010', 'energy/electricity', 2005, { region: 'HK-HKE', status: 'deprecated' }),
  F('hk.energy.town-gas.purchased.2025', 'energy/town-gas', 2025),
  F('hk.water.fresh-water.wsd.2021', 'water/fresh-water', 2021),
  F('hk.transport.rail.mtr-co2-per-pkm.2024', 'transport/rail', 2024),
];

test('parseBody trims, caps and checks the last message', () => {
  const r = parseBody({ messages: [{ role: 'user', content: ' x'.repeat(500) }], lang: 'en' });
  assert.equal(r.lang, 'en');
  assert.ok(r.messages[0].content.length <= 600);
  assert.throws(() => parseBody({ messages: [{ role: 'assistant', content: 'hi' }] }));
  assert.throws(() => parseBody({}));
});

test('pickFactors follows topic, region and year; skips non-reviewed', () => {
  const ids = (t) => pickFactors(factors, t).map((f) => f.id);
  assert.equal(ids('港岛用电 2025 年怎么算')[0], 'hk.energy.electricity.hke.2025');
  assert.ok(ids('中電 2024').includes('hk.energy.electricity.clp.2024'));
  assert.ok(!ids('港燈 2005').includes('hk.energy.electricity.hke.2005-emsd2010'));
  assert.deepEqual(ids('坐港鐵').slice(0, 1), ['hk.transport.rail.mtr-co2-per-pkm.2024']);
  assert.ok(ids('hello').length >= 3, 'falls back to everyday series');
});

test('systemPrompt lists the factors with ids', () => {
  const p = systemPrompt({ lang: 'zh', factors: factors.slice(0, 1), inventory: [] });
  assert.match(p, /\[hk\.energy\.electricity\.clp\.2024\]/);
  assert.match(p, /Never invent a number/);
});

test('cleanAnswer drops reasoning blocks', () => {
  assert.equal(cleanAnswer('<think>a\nb</think>\n答案'), '答案');
});

test('worker: origin check, validation, model fallback', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ factors, inventory: [] }));
  const calls = [];
  const env = {
    ALLOWED_ORIGINS: 'https://site.example',
    DATA_URL: 'https://site.example/data.json',
    MODELS: 'm1,m2',
    PER_MINUTE: '100',
    AI: { run: async (model, input) => { calls.push(model); if (model === 'm1') throw new Error('boom'); assert.equal(input.messages[0].role, 'system'); return { response: '<think>x</think>中電 2025 年 [hk.energy.electricity.clp.2025]' }; } },
  };
  const req = (origin, body) => new Request('https://w.example/chat', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await worker.fetch(req('https://evil.example', { messages: [{ role: 'user', content: 'hi' }] }), env)).status, 403);
    assert.equal((await worker.fetch(req('https://site.example', { messages: [] }), env)).status, 400);
    const ok = await worker.fetch(req('https://site.example', { messages: [{ role: 'user', content: '中電用電' }] }), env);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.model, 'm2');
    assert.deepEqual(calls, ['m1', 'm2']);
    assert.ok(!body.answer.includes('think'));
    assert.ok(body.factors.includes('hk.energy.electricity.clp.2025'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
