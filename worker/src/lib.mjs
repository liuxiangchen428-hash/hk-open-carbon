// Pure helpers for the AI assistant Worker (no Cloudflare APIs here, so they can be tested in Node).

export const LIMITS = { messages: 8, chars: 600, factors: 28 };

/** Validate the request body. Returns { messages, lang } or throws an Error with a user-safe message. */
export function parseBody(body) {
  if (!body || !Array.isArray(body.messages)) throw new Error('messages must be an array');
  const messages = body.messages.slice(-LIMITS.messages).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content ?? '').trim().slice(0, LIMITS.chars),
  })).filter((m) => m.content);
  if (!messages.length || messages.at(-1).role !== 'user') throw new Error('the last message must be from the user');
  return { messages, lang: body.lang === 'en' ? 'en' : 'zh' };
}

// Topic words (Traditional and Simplified Chinese, English) -> category prefixes.
const TOPICS = [
  [/電|电|electric|kwh|度電|度电|供電|供电|grid|中電|中电|港燈|港灯|clp|hk ?electric/i, 'energy/electricity'],
  [/煤氣|煤气|town ?gas|towngas|gas bill|煮食/i, 'energy/town-gas'],
  [/汽油|柴油|石油氣|石油气|火水|燃料|fuel|petrol|diesel|lpg|kerosene|charcoal|木炭|私家車|私家车|car\b|車|车/i, 'energy/fuel'],
  [/水|water|sewage|污水/i, 'water'],
  [/港鐵|港铁|地鐵|地铁|mtr|巴士|bus|交通|transport|通勤|commut/i, 'transport'],
  [/冷媒|製冷|制冷|雪種|雪种|refrigerant|hfc|r-?\d{2,3}|gwp/i, 'buildings'],
  [/廢|废|紙|纸|堆填|waste|landfill|paper/i, 'waste'],
  [/樹|树|tree|植物/i, 'land'],
];
const REGIONS = [
  [/中電|中电|clp|九龍|九龙|新界|kowloon|new territories/i, 'HK-CLP'],
  [/港燈|港灯|hk ?electric|港島|港岛|香港島|香港岛|hong kong island|南丫|lamma|鴨脷洲|鸭脷洲/i, 'HK-HKE'],
];
// Narrower hints: a series or gas the question names gets an extra boost.
const HINTS = [
  [/港鐵|港铁|地鐵|地铁|mtr/i, (f) => f.id.includes('.mtr')],
  [/巴士|bus/i, (f) => f.id.includes('.bus.')],
  [/私家車|私家车|\bcar\b/i, (f) => f.id.includes('passenger-car')],
  [/二氧化碳|\bco2\b(?!e)/i, (f) => f.gas === 'CO2'],
  [/甲烷|ch4/i, (f) => f.gas === 'CH4'],
  [/氧化亞氮|氧化亚氮|n2o/i, (f) => f.gas === 'N2O'],
  [/食水|自來水|自来水|fresh ?water/i, (f) => f.id.includes('fresh-water')],
  [/污水|sewage/i, (f) => f.id.includes('sewage')],
];

// Always useful when the question names no topic: the latest factor of each everyday series.
const STARTERS = ['hk.energy.electricity.clp.', 'hk.energy.electricity.hke.', 'hk.energy.town-gas.', 'hk.water.fresh-water.', 'hk.water.sewage.', 'hk.transport.rail.mtr', 'hk.transport.bus.'];

const nameOf = (f, lang) => (lang === 'en' ? f.name?.en : f.name?.['zh-Hant']) ?? f.id;

/** Pick the reviewed factors most relevant to the conversation. */
export function pickFactors(factors, text, { limit = LIMITS.factors } = {}) {
  const usable = factors.filter((f) => f.status === 'reviewed');
  const cats = TOPICS.filter(([re]) => re.test(text)).map(([, c]) => c);
  const regions = REGIONS.filter(([re]) => re.test(text)).map(([, r]) => r);
  const years = [...new Set((text.match(/(?:19|20)\d{2}/g) ?? []).map(Number))];
  const lower = text.toLowerCase();
  const hints = HINTS.filter(([re]) => re.test(text)).map(([, fn]) => fn);
  const scored = usable.map((f) => {
    let s = 0;
    if (hints.some((fn) => fn(f))) s += 4;
    if (cats.some((c) => f.category.startsWith(c))) s += 10;
    if (regions.includes(f.region)) s += 6;
    if (years.includes(f.year)) s += 5;
    if (f.tags?.includes('historical')) s -= years.includes(f.year) ? 0 : 4;
    // exact refrigerant or id fragments, e.g. "R-410A"
    const short = f.id.split('.').slice(2).join(' ');
    if (short && lower.split(/[^a-z0-9-]+/).some((w) => w.length > 3 && short.includes(w))) s += 4;
    s += (f.year ?? 2000) / 10000; // newer first on ties
    return { f, s };
  });
  let picked = scored.filter((x) => x.s >= 5).sort((a, b) => b.s - a.s).map((x) => x.f);
  if (!picked.length) {
    // No topic: newest factor of each everyday series.
    for (const p of STARTERS) {
      const latest = usable.filter((f) => f.id.startsWith(p) && !f.tags?.includes('historical')).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
      if (latest) picked.push(latest);
    }
  }
  return picked.slice(0, limit);
}

/** One compact line per factor for the prompt. */
export function factorLines(list, lang) {
  return list.map((f) => `[${f.id}] ${nameOf(f, lang)} = ${f.value} ${f.unit}${f.unit_definition ? ` (${lang === 'en' ? f.unit_definition.en : f.unit_definition['zh-Hant']})` : ''}; year ${f.year}; region ${f.region}; gas ${f.gas}; quality ${f.quality}; source ${f.source?.id}${f.source?.page ? ` p.${f.source.page}` : ''}`).join('\n');
}

/** A few lines on the territory-wide inventory and Hong Kong's targets. */
export function inventoryLines(inv) {
  const t = inv?.[0];
  if (!t?.rows?.length) return '';
  const last = t.rows.at(-1);
  const base = t.rows.find((r) => r.year === 2005);
  const goal = t.targets?.find((x) => x.reduction);
  const out = [`Hong Kong GHG inventory (${t.edition}, ${t.gwp}, kt CO2e): ${last.year} total ${last.total}, per capita ${last.per_capita} t, electricity ${last.electricity}, transport ${last.transport}, other fuel use ${last.other_fuel}, waste ${last.waste}.`];
  if (base) out.push(`2005 total ${base.total} (base year).`);
  if (goal && base) out.push(`Hong Kong target (Climate Action Plan 2050): halve total emissions from the 2005 level before ${goal.year}, i.e. about ${Math.round(base.total * (1 - goal.reduction))} kt; carbon neutrality before 2050.`);
  return out.join(' ');
}

export function systemPrompt({ lang, factors, inventory }) {
  return [
    'You are the assistant of the HK Open Carbon Platform, an open database of Hong Kong emission factors.',
    'Answer ONLY from the data below. Never invent a number. If the data does not cover the question, say so and suggest the Sources page or asking the maintainer.',
    'When you use a factor, cite its id in square brackets exactly as given, e.g. [hk.energy.electricity.clp.2025]. Show the arithmetic: emissions = activity x factor, with units.',
    'Use the factor for the same year and supply area as the activity; electricity on Hong Kong Island, Ap Lei Chau and Lamma is HK Electric (HK-HKE), elsewhere mostly CLP (HK-CLP).',
    'Values are for reference; for formal disclosure users should rely on official publications and their verifier. Do not give legal advice.',
    lang === 'en' ? 'Reply in English.' : 'Reply in the same Chinese script the user writes in (Traditional or Simplified).',
    'Be concise: at most about 150 words unless a calculation needs more.',
    '',
    'Factors (reviewed):',
    factorLines(factors, lang) || '(none matched)',
    '',
    inventoryLines(inventory),
  ].join('\n');
}

/** Remove reasoning blocks some open models emit. */
export const cleanAnswer = (s) => String(s ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
