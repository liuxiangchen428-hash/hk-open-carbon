/* HK Open Carbon Platform — browser script (no dependencies). */
(() => {
  'use strict';

  const html = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- language ---------- */
  const lang = () => (html.dataset.lang === 'en' ? 'en' : 'zh');
  const L = (zh, en) => (lang() === 'en' ? en : zh);
  const nm = (obj) => (obj ? (lang() === 'en' ? obj.en : obj['zh-Hant']) ?? obj.en ?? '' : '');
  const rerender = [];
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-lang-toggle]')) return;
    html.dataset.lang = lang() === 'en' ? 'zh' : 'en';
    html.lang = lang() === 'en' ? 'en' : 'zh-Hant';
    try { localStorage.setItem('hkoc-lang', html.dataset.lang); } catch {}
    rerender.forEach((fn) => fn());
  });
  html.lang = lang() === 'en' ? 'en' : 'zh-Hant';

  /* ---------- labels & formatting ---------- */
  const REGION = { HK: ['全港', 'Hong Kong'], 'HK-CLP': ['中電供電區', 'CLP supply area'], 'HK-HKE': ['港燈供電區', 'HK Electric area'], GLOBAL: ['國際', 'International'] };
  const STATUS = { reviewed: ['已審核', 'Reviewed'], draft: ['草稿', 'Draft'], deprecated: ['已取代', 'Superseded'] };
  const QUALITY = { A: ['香港政府', 'HK government'], B: ['本地企業或機構', 'Local company or body'], C: ['國際預設值', 'International default'], D: ['推算值', 'Derived'] };
  const BY = { maintainer: ['維護者', 'Maintainer'], claude: ['AI 助手', 'AI assistant'] };
  const METHOD = { 'pdf-visual': ['看原文頁面', 'Read on the page'], 'text-extract': ['從原文文字讀取', 'Read from source text'], recalculation: ['重新計算', 'Recalculated'] };
  const BOUNDARY = {
    combustion: ['燃燒', 'Combustion'], 'location-based': ['按地點', 'Location-based'], 'market-based': ['按市場', 'Market-based'],
    'cradle-to-gate': ['搖籃到大門', 'Cradle to gate'], 'cradle-to-grave': ['搖籃到墳墓', 'Cradle to grave'],
    'well-to-wheel': ['油井到車輪', 'Well to wheel'], 'tank-to-wheel': ['油箱到車輪', 'Tank to wheel'],
  };
  const GWP = { 'not-stated': ['原文未註明', 'Not stated'] };
  const ACTIVITY = {
    kWh: ['度（kWh）', 'kWh'], MJ: ['兆焦耳', 'MJ'], TJ: ['太焦耳（TJ）', 'TJ'], L: ['公升', 'litre'], kg: ['公斤', 'kg'], t: ['公噸', 'tonne'],
    m3: ['立方米', 'm³'], pkm: ['乘客公里', 'passenger-km'], vkm: ['車公里', 'vehicle-km'], Mvkm: ['百萬車公里', 'million vehicle-km'],
    unit: ['單位', 'unit'], trip: ['程', 'trip'],
  };
  const pick = (map, k) => (map[k] ? L(map[k][0], map[k][1]) : k);
  const gasFmt = (s) => s.replace(/CO2e/g, 'CO₂e').replace(/CO2(?!e)/g, 'CO₂').replace(/CH4/g, 'CH₄').replace(/N2O/g, 'N₂O');
  const splitUnit = (unit) => {
    const [em, act] = unit.split('/');
    const m = em.match(/^(kg|g|t)(.+)$/);
    return { mass: m ? m[1] : '', gas: gasFmt(m ? m[2] : em), act };
  };
  const emissionFmt = (unit) => { const u = splitUnit(unit); return `${u.mass} ${u.gas}`.trim(); };
  const unitFmt = (unit) => `${emissionFmt(unit)} / ${pick(ACTIVITY, splitUnit(unit).act)}`;
  const yearFmt = (f) => (f.tags?.includes('fiscal-year') ? `${f.year}/${String((f.year + 1) % 100).padStart(2, '0')}` : String(f.year));
  const groupDigits = (s) => {
    const [i, d] = String(s).split('.');
    return (i.length > 3 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i) + (d !== undefined ? `.${d}` : '');
  };
  const numFmt = (n, max = 3) => n.toLocaleString(lang() === 'en' ? 'en' : 'zh-HK', { maximumFractionDigits: max });
  const statusTag = (s) => `<span class="status ${esc(s)}">${esc(pick(STATUS, s))}</span>`;
  const qTag = (q) => `<span class="q q-${esc(q)}" title="${esc(pick(QUALITY, q))}">${esc(q)}</span>`;

  /* ---------- data ---------- */
  let DATA;
  const dataReady = fetch('assets/data.json').then((r) => r.json()).then((d) => (DATA = d));
  const sourceById = () => new Map(DATA.sources.map((s) => [s.id, s]));
  const isYearly = (f) => /\.\d{4}$/.test(f.id);
  const seriesOf = (f) => f.id.replace(/\.\d{4}$/, '');
  /** Non-historical yearly members of a series, oldest first. */
  const seriesItems = (key, { recent = false } = {}) =>
    DATA.factors
      .filter((f) => isYearly(f) && seriesOf(f) === key && (!recent || !f.tags?.includes('historical')))
      .sort((a, b) => a.year - b.year);

  /* ---------- charts (plain SVG) ---------- */
  function niceTicks(min, max, count = 4) {
    if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
    const raw = (max - min) / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toPrecision(10));
    return { ticks, lo, hi, step };
  }
  const tickFmt = (v, step) => numFmt(v, Math.max(0, -Math.floor(Math.log10(step)) + 1));

  /**
   * Interactive line chart. series: [{ label, cls, points: [{ x, value, text, id }] }]
   * The x axis is categorical (year labels), shared across series.
   */
  function lineChart(el, series, { height = 260 } = {}) {
    const draw = () => {
      const width = Math.max(280, el.clientWidth);
      const pad = { t: 18, r: 18, b: 30, l: 46 };
      const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
      const values = series.flatMap((s) => s.points.map((p) => p.value));
      const span = Math.max(...values) - Math.min(...values);
      const { ticks, lo, hi, step } = niceTicks(Math.min(...values) - span * 0.15, Math.max(...values) + span * 0.15);
      const X = (x) => pad.l + (xs.length === 1 ? (width - pad.l - pad.r) / 2 : (xs.indexOf(x) * (width - pad.l - pad.r)) / (xs.length - 1));
      const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);
      let svg = `<svg class="lc" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(series.map((s) => s.label).join(' / '))}">`;
      svg += `<defs><linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="lc-fill-a"/><stop offset="1" class="lc-fill-b"/></linearGradient></defs>`;
      for (const t of ticks) {
        svg += `<line class="lc-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/>`;
        svg += `<text class="lc-tick" x="${pad.l - 10}" y="${Y(t) + 4}" text-anchor="end">${esc(tickFmt(t, step))}</text>`;
      }
      const gap = xs.length > 1 ? (width - pad.l - pad.r) / (xs.length - 1) : width;
      const every = gap < 38 ? 5 : 1;
      xs.forEach((x, i) => {
        const last = i === xs.length - 1;
        if (every > 1 && !last && (i % every !== (xs.length - 1) % every || xs.length - 1 - i < every)) return;
        svg += `<text class="lc-tick" x="${X(x)}" y="${height - 8}" text-anchor="middle">${esc(x)}</text>`;
      });
      series.forEach((s, i) => {
        const pts = s.points.map((p) => [X(p.x), Y(p.value)]);
        const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
        if (i === 0 && pts.length > 1) svg += `<path class="lc-area" d="${d}L${pts.at(-1)[0].toFixed(1)},${height - pad.b}L${pts[0][0].toFixed(1)},${height - pad.b}Z" fill="url(#lc-fill)"/>`;
        svg += `<path class="lc-line ${s.cls}" d="${d}" pathLength="1"/>`;
        s.points.forEach((p) => { svg += `<circle class="lc-pt ${s.cls}" data-x="${esc(p.x)}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="3.5"/>`; });
        const last = s.points.at(-1);
        svg += `<text class="lc-end ${s.cls}" x="${(X(last.x) + 8).toFixed(1)}" y="${(Y(last.value) - 10).toFixed(1)}" text-anchor="end">${esc(last.text)}</text>`;
      });
      svg += `<line class="lc-cross" x1="0" x2="0" y1="${pad.t}" y2="${height - pad.b}" visibility="hidden"/>`;
      // hover bands
      xs.forEach((x, i) => {
        const left = i === 0 ? pad.l : (X(xs[i - 1]) + X(x)) / 2;
        const right = i === xs.length - 1 ? width - pad.r : (X(x) + X(xs[i + 1])) / 2;
        svg += `<rect class="lc-hit" data-x="${esc(x)}" x="${left}" y="${pad.t}" width="${right - left}" height="${height - pad.t - pad.b}"/>`;
      });
      svg += '</svg>';
      el.innerHTML = `${svg}<div class="lc-tip" hidden></div>`;
      el.dataset.drawn = 'true';
      const tip = $('.lc-tip', el);
      const cross = $('.lc-cross', el);
      const show = (x) => {
        cross.setAttribute('x1', X(x)); cross.setAttribute('x2', X(x)); cross.setAttribute('visibility', 'visible');
        $$('.lc-pt', el).forEach((c) => c.classList.toggle('on', c.dataset.x === x));
        const rows = series.map((s) => {
          const p = s.points.find((q) => q.x === x);
          return p ? `<div class="r"><span class="sw ${s.cls}"></span><span>${esc(s.label)}</span><b>${esc(p.text)}</b></div>` : '';
        }).join('');
        tip.innerHTML = `<div class="y">${esc(x)}</div>${rows}`;
        tip.hidden = false;
        const tx = X(x);
        tip.style.left = `${Math.min(Math.max(tx, 90), width - 90)}px`;
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; $$('.lc-pt', el).forEach((c) => c.classList.remove('on')); };
      $$('.lc-hit', el).forEach((r) => {
        r.addEventListener('mouseenter', () => show(r.dataset.x));
        r.addEventListener('click', () => show(r.dataset.x));
      });
      $('svg', el).addEventListener('mouseleave', hide);
    };
    draw();
    if (!el._ro) {
      let w = el.clientWidth;
      el._ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; el._redraw?.(); } });
      el._ro.observe(el);
    }
    el._redraw = draw;
  }

  /** Zero-based vertical bar chart; bars are buttons that open the factor. */
  function barChart(items, { current, height = 132 } = {}) {
    const max = Math.max(...items.map((f) => Math.abs(f.value))) || 1;
    return `<div class="bc" style="--h:${height}px">${items.map((f) => {
      const h = Math.max(2, (Math.abs(f.value) / max) * 100);
      return `<button type="button" class="bc-col${f.id === current ? ' cur' : ''}${f.tags?.includes('historical') ? ' hist' : ''}" data-open="${esc(f.id)}"
        aria-label="${esc(`${yearFmt(f)}: ${f.value_text} ${unitFmt(f.unit)}`)}">
        <span class="bc-val">${esc(groupDigits(f.value_text))}</span>
        <span class="bc-bar"><span style="height:${h.toFixed(1)}%"></span></span>
        <span class="bc-x">${esc(yearFmt(f))}</span></button>`;
    }).join('')}</div>`;
  }

  /* ---------- home dashboard ---------- */
  const DASH = [
    { key: 'hk.energy.electricity.clp', label: ['中電 · 每度電', 'CLP · per kWh'], short: ['中電', 'CLP'], compare: 'hk.energy.electricity.hke' },
    { key: 'hk.energy.electricity.hke', label: ['港燈 · 每度電', 'HK Electric · per kWh'], short: ['港燈', 'HK Electric'], compare: 'hk.energy.electricity.clp' },
    { key: 'hk.energy.town-gas.purchased', label: ['煤氣生產 · 每單位', 'Town gas production · per unit'], short: ['煤氣生產', 'Gas production'] },
    { key: 'hk.water.fresh-water.wsd', label: ['食水供應 · 每立方米', 'Fresh water · per m³'], short: ['食水', 'Fresh water'], compare: 'hk.water.sewage.dsd' },
  ];
  const SHORT = { 'hk.water.sewage.dsd': ['污水處理', 'Sewage'] };
  const dash = { i: 0, compare: false };

  function deltaOf(items) {
    const last = items.at(-1), prev = items.at(-2);
    if (!prev || !prev.value) return null;
    const d = ((last.value - prev.value) / prev.value) * 100;
    return { d, cls: d < -0.05 ? 'down' : d > 0.05 ? 'up' : 'flat', sign: d < -0.05 ? '↓' : d > 0.05 ? '↑' : '→', prev };
  }

  function renderDash() {
    const tabs = $('#dash-tabs');
    if (!tabs) return;
    tabs.innerHTML = DASH.map((c, i) => {
      const items = seriesItems(c.key, { recent: true });
      const last = items.at(-1);
      if (!last) return '';
      const dl = deltaOf(items);
      return `<button type="button" class="dash-tab" role="tab" aria-selected="${i === dash.i}" data-i="${i}">
        <span class="t-label">${esc(L(...c.label))}</span>
        <span class="t-value"><span class="num">${esc(last.value_text)}</span><span class="u">${esc(emissionFmt(last.unit))}</span></span>
        <span class="t-foot"><span class="t-year">${esc(yearFmt(last))}</span>${dl ? `<span class="delta ${dl.cls}">${dl.sign} ${Math.abs(dl.d).toFixed(1)}%</span>` : ''}</span>
      </button>`;
    }).join('');

    const c = DASH[dash.i];
    const items = seriesItems(c.key, { recent: true });
    const last = items.at(-1);
    const toPoints = (arr) => arr.map((f) => ({ x: yearFmt(f), value: f.value, text: groupDigits(f.value_text), id: f.id }));
    const series = [{ label: L(...c.short), cls: 's1', points: toPoints(items) }];
    const cmpShort = c.compare && (DASH.find((d) => d.key === c.compare)?.short || SHORT[c.compare]);
    if (c.compare && dash.compare) {
      const other = seriesItems(c.compare, { recent: true });
      if (other.length) series.push({ label: L(...cmpShort), cls: 's2', points: toPoints(other) });
    }
    const first = items[0];
    const dl = deltaOf(items);
    const change = items.length > 1 ? ((last.value - first.value) / first.value) * 100 : 0;
    $('#dash-title').textContent = stripYear(nm(last.name), last.year);
    $('#dash-sub').textContent = `${unitFmt(last.unit)} · ${yearFmt(first)}–${yearFmt(last)}`;
    $('#dash-actions').innerHTML = c.compare
      ? `<button type="button" class="pill" data-compare aria-pressed="${dash.compare}"><span class="sw s2"></span>${esc(L(`對比${L(...cmpShort)}`, `Compare ${L(...cmpShort)}`))}</button>`
      : '';
    $('#dash-foot').innerHTML = `
      <div class="kpis">
        <div><span>${esc(L('最新', 'Latest'))}</span><b>${esc(groupDigits(last.value_text))}</b></div>
        ${dl ? `<div><span>${esc(L(`對比 ${yearFmt(dl.prev)}`, `vs ${yearFmt(dl.prev)}`))}</span><b class="delta-ink ${dl.cls}">${dl.sign} ${Math.abs(dl.d).toFixed(1)}%</b></div>` : ''}
        ${items.length > 2 ? `<div><span>${esc(L(`${yearFmt(first)} 至今`, `Since ${yearFmt(first)}`))}</span><b class="delta-ink ${change < 0 ? 'down' : change > 0 ? 'up' : 'flat'}">${change < 0 ? '↓' : change > 0 ? '↑' : '→'} ${Math.abs(change).toFixed(1)}%</b></div>` : ''}
      </div>
      <a class="pill pill-solid" href="#f=${encodeURIComponent(last.id)}">${esc(L('查看最新系數', 'Open latest factor'))} →</a>`;
    lineChart($('#dash-chart'), series);
  }

  function initDash() {
    const root = $('#dash');
    if (!root) return;
    root.addEventListener('click', (e) => {
      const tab = e.target.closest('.dash-tab');
      if (tab) { dash.i = +tab.dataset.i; dash.compare = false; renderDash(); return; }
      if (e.target.closest('[data-compare]')) { dash.compare = !dash.compare; renderDash(); }
    });
    $('#dash-tabs').addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      dash.i = (dash.i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : DASH.length - 1)) % DASH.length;
      dash.compare = false;
      renderDash();
      $(`.dash-tab[data-i="${dash.i}"]`)?.focus();
    });
    renderDash();
    rerender.push(renderDash);
  }

  /* ---------- grouping of factor cards ---------- */
  const GAS_SEG = /\.(co2|ch4|n2o)(?=\.|$)/;
  function groupOf(f) {
    if (isYearly(f)) return { key: seriesOf(f), kind: 'yearly' };
    if (GAS_SEG.test(f.id)) return { key: f.id.replace(GAS_SEG, '').replace(/\.mobile-(litre|kg)/, '.mobile'), kind: 'gas' };
    if (f.tags?.includes('ipcc-default')) return { key: `ipcc:${f.category}`, kind: 'names' };
    if (f.tags?.includes('refrigerant-gwp')) return { key: `refgwp:${f.source.id}`, kind: 'names' };
    return { key: f.id, kind: 'single' };
  }
  const stripYear = (s, y) => s.replace(new RegExp(`\\s*[（(][^（）()]*${y}[^（）()]*[）)]\\s*$`), '').trim();
  const stripGas = (s) => s.replace(/(二氧化碳|甲烷|氧化亞氮)/g, '').replace(/\s(CO2|CH4|N2O)\b/g, '').replace(/\s{2,}/g, ' ').trim();
  function commonSuffix(names) {
    let s = names[0];
    for (const n of names.slice(1)) {
      let i = 0;
      while (i < s.length && i < n.length && s[s.length - 1 - i] === n[n.length - 1 - i]) i++;
      s = s.slice(s.length - i);
    }
    if (lang() === 'en') s = s.slice(Math.max(0, s.indexOf(' ')));
    return s;
  }

  /* ---------- factor browser ---------- */
  $('.site-nav [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const page = document.body.dataset.page;
  if (page === 'index') dataReady.then(() => { initDash(); initBrowser(); });
  if (page === 'sources') dataReady.then(initSources);
  if (page === 'inventory') dataReady.then(initInventory);
  if (page === 'calculator') dataReady.then(initCalculator);

  function initBrowser() {
    const state = { cat: 'all', status: 'all', q: '', charts: new Set() };
    const q = $('#q');
    const catList = $('#cat-list');
    const groupsEl = $('#groups');
    const countEl = $('#count');
    const emptyEl = $('#empty');

    function matches(f) {
      if (state.cat !== 'all' && f.category !== state.cat) return false;
      if (state.status !== 'all' && f.status !== state.status) return false;
      if (!state.q) return true;
      const src = sourceById().get(f.source.id);
      const hay = [f.id, f.name['zh-Hant'], f.name.en, f.category, String(f.year), f.unit, (f.tags || []).join(' '),
        src?.title, src?.title_zh, src?.publisher].join(' ').toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }

    function renderCats() {
      const counts = new Map();
      for (const f of DATA.factors) counts.set(f.category, (counts.get(f.category) || 0) + 1);
      const used = DATA.categories.filter((c) => counts.has(c.id));
      let out = `<li><button type="button" data-cat="all" aria-pressed="${state.cat === 'all'}"><span>${esc(L('全部系數', 'All factors'))}</span><span class="n">${DATA.factors.length}</span></button></li>`;
      let lastGroup = '';
      for (const c of used) {
        if (c.group !== lastGroup) { out += `<li><p class="group-label">${esc(nm(c.groupName))}</p></li>`; lastGroup = c.group; }
        out += `<li><button type="button" data-cat="${esc(c.id)}" aria-pressed="${state.cat === c.id}"><span>${esc(nm(c.name))}</span><span class="n">${counts.get(c.id)}</span></button></li>`;
      }
      catList.innerHTML = out;
    }

    function render() {
      q.placeholder = L('搜尋系數，例如 柴油', 'Search, e.g. diesel');
      renderCats();
      const list = DATA.factors.filter(matches);
      countEl.textContent = L(`顯示 ${list.length} / ${DATA.factors.length} 個系數`, `Showing ${list.length} of ${DATA.factors.length} factors`);
      emptyEl.hidden = list.length > 0;

      let out = '';
      for (const cat of DATA.categories) {
        const inCat = list.filter((f) => f.category === cat.id);
        if (!inCat.length) continue;
        const cards = new Map();
        for (const f of inCat) {
          const g = groupOf(f);
          if (!cards.has(g.key)) cards.set(g.key, { key: g.key, kind: g.kind, items: [] });
          cards.get(g.key).items.push(f);
        }
        const ordered = [...cards.values()].sort((a, b) =>
          Math.max(...b.items.map((x) => x.year)) - Math.max(...a.items.map((x) => x.year)) ||
          a.items[0].quality.localeCompare(b.items[0].quality) ||
          nm(a.items[0].name).localeCompare(nm(b.items[0].name)));
        out += `<section class="group"><div class="group-head"><h2>${esc(nm(cat.name))}</h2><span class="sub">${esc(nm(cat.groupName))}</span></div>`;
        for (const { key, kind, items } of ordered) {
          const gasOrder = { CO2: 0, CO2e: 0, CH4: 1, N2O: 2 };
          if (kind === 'yearly') items.sort((a, b) => b.year - a.year);
          else if (kind === 'gas') items.sort((a, b) => (gasOrder[a.gas] ?? 9) - (gasOrder[b.gas] ?? 9) || a.unit.localeCompare(b.unit));
          else if (kind === 'names') items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || nm(a.name).localeCompare(nm(b.name)));
          const f0 = items[0];
          const suffix = kind === 'names' && items.length > 1 ? commonSuffix(items.map((x) => nm(x.name))) : '';
          const title =
            kind === 'yearly' ? stripYear(nm(f0.name), f0.year)
            : kind === 'gas' ? stripGas(nm(f0.name))
            : kind === 'names' ? suffix.replace(/^[\s·,，、]+/, '') || nm(f0.name)
            : nm(f0.name);
          const max = Math.max(...items.map((x) => Math.abs(x.value)));
          const regions = [...new Set(items.map((x) => x.region))].map((r) => `<span class="chip">${esc(pick(REGION, r))}</span>`).join('');
          const scope = f0.scope ? `<span class="chip">${esc(L(`範圍 ${f0.scope}`, `Scope ${f0.scope}`))}</span>` : '';
          const canChart = kind === 'yearly' && items.length >= 3;
          const asChart = canChart && state.charts.has(key);
          const toggle = canChart
            ? `<div class="view-toggle" role="group" aria-label="${esc(L('顯示方式', 'View'))}">
                <button type="button" data-view="list" data-key="${esc(key)}" aria-pressed="${!asChart}" title="${esc(L('列表', 'List'))}">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10"/></svg></button>
                <button type="button" data-view="chart" data-key="${esc(key)}" aria-pressed="${asChart}" title="${esc(L('走勢', 'Trend'))}">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13V9M6.5 13V6M10 13V8M13.5 13V3"/></svg></button>
              </div>` : '';
          out += `<div class="series"><div class="series-head"><h3>${esc(title)}</h3><div class="meta">${regions}${scope}${qTag(f0.quality)}${toggle}</div></div>`;
          if (asChart) {
            out += `<div class="series-chart">${barChart([...items].reverse(), {})}<p class="chart-note">${esc(unitFmt(f0.unit))} · ${esc(L('點選柱狀查看詳情', 'Select a bar for details'))}</p></div>`;
          } else {
            for (const f of items) {
              let label;
              if (kind === 'yearly' && items.length > 1) {
                const w = max ? Math.max(2, (Math.abs(f.value) / max) * 100) : 0;
                label = `<span class="bar" aria-hidden="true"><span style="width:${w.toFixed(1)}%"></span></span>`;
                if (f.tags?.includes('historical')) label += `<span class="tag-sm">${esc(L('歷史', 'Historical'))}</span>`;
              } else if (kind === 'names' && suffix) {
                label = esc(nm(f.name).slice(0, nm(f.name).length - suffix.length).trim());
              } else {
                label = esc(gasFmt(f.gas));
              }
              out += `<button type="button" class="row" data-open="${esc(f.id)}">
                <span class="yr">${esc(yearFmt(f))}</span>
                <span class="label">${label}</span>
                <span class="val">${esc(groupDigits(f.value_text))}<span class="u">${esc(unitFmt(f.unit))}</span></span>
                <span class="st">${statusTag(f.status)}</span>
              </button>`;
            }
          }
          out += '</div>';
        }
        out += '</section>';
      }
      groupsEl.innerHTML = out;
    }

    catList.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]');
      if (b) { state.cat = b.dataset.cat; render(); }
    });
    $('#status-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-status]');
      if (!b) return;
      state.status = b.dataset.status;
      for (const x of $$('#status-seg button')) x.setAttribute('aria-pressed', String(x === b));
      render();
    });
    let timer;
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = q.value.trim(); render(); }, 120); });
    $('[data-filters-toggle]').addEventListener('click', () => $('#filters').classList.toggle('open'));
    groupsEl.addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]');
      if (v) {
        if (v.dataset.view === 'chart') state.charts.add(v.dataset.key); else state.charts.delete(v.dataset.key);
        render();
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) location.hash = `f=${encodeURIComponent(open.dataset.open)}`;
    });

    initDrawer();
    rerender.push(render);
    render();
  }

  /* ---------- detail drawer ---------- */
  function initDrawer() {
    const drawer = $('#drawer');
    const scrim = $('.drawer-scrim');
    const body = $('#drawer-body');
    let lastFocus = null;
    let currentId = null;

    function close() {
      if (!drawer.classList.contains('open')) return;
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      scrim.hidden = true;
      document.body.style.overflow = '';
      currentId = null;
      if (location.hash.startsWith('#f=')) history.replaceState(null, '', location.pathname + location.search);
      lastFocus?.focus?.();
    }

    function open(id) {
      const f = DATA.factors.find((x) => x.id === id);
      if (!f) return close();
      if (!drawer.classList.contains('open')) lastFocus = document.activeElement;
      const amount = currentId && seriesOf(DATA.factors.find((x) => x.id === currentId) || f) === seriesOf(f) ? $('#calc-in', body)?.value : '';
      currentId = id;
      body.innerHTML = detail(f);
      if (amount) { $('#calc-in', body).value = amount; calc(f); }
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      scrim.hidden = false;
      document.body.style.overflow = 'hidden';
      drawer.scrollTop = 0;
      $('.d-close', body).focus({ preventScroll: true });
    }

    function calc(f) {
      const input = $('#calc-in', body);
      const out = $('#calc-out', body);
      if (!input || !out) return;
      const n = parseFloat(String(input.value).replace(/,/g, ''));
      if (!Number.isFinite(n) || input.value === '') { out.innerHTML = `<span class="muted">${esc(L('輸入用量即時計算', 'Enter an amount to calculate'))}</span>`; return; }
      const { mass, gas } = splitUnit(f.unit);
      const result = n * f.value;
      let main = `${numFmt(result, 2)} ${mass} ${gas}`;
      let alt = '';
      if (mass === 'kg' && result >= 1000) alt = `≈ ${numFmt(result / 1000, 2)} t ${gas}`;
      if (mass === 'g' && result >= 1000) alt = `≈ ${numFmt(result / 1000, 2)} kg ${gas}`;
      if (mass === 't' && f.unit.endsWith('/Mvkm')) alt = `≈ ${numFmt(result * 1000, 0)} kg ${gas}`;
      out.innerHTML = `<b>${esc(main)}</b>${alt ? `<span>${esc(alt)}</span>` : ''}`;
    }

    const fromHash = () => {
      const m = location.hash.match(/^#f=(.+)$/);
      if (m) open(decodeURIComponent(m[1])); else close();
    };
    window.addEventListener('hashchange', fromHash);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    body.addEventListener('input', (e) => {
      if (e.target.id === 'calc-in') calc(DATA.factors.find((x) => x.id === currentId));
    });
    body.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]')) return close();
      const openBtn = e.target.closest('[data-open]');
      if (openBtn) { location.hash = `f=${encodeURIComponent(openBtn.dataset.open)}`; return; }
      const preset = e.target.closest('[data-preset]');
      if (preset) { $('#calc-in', body).value = preset.dataset.preset; calc(DATA.factors.find((x) => x.id === currentId)); return; }
      const copy = e.target.closest('[data-copy]');
      if (copy) {
        try {
          await navigator.clipboard.writeText(copy.dataset.copy);
          const old = copy.textContent;
          copy.textContent = L('已複製', 'Copied');
          setTimeout(() => { copy.textContent = old; }, 1400);
        } catch {}
      }
    });
    rerender.push(() => { if (drawer.classList.contains('open')) fromHash(); });
    fromHash();
  }

  const PRESETS = { kWh: [100, 1000, 10000], unit: [10, 100, 1000], m3: [10, 100, 1000], L: [10, 100, 1000], kg: [1, 10, 100], pkm: [10, 100, 1000], trip: [1, 10, 100], TJ: [1, 10, 100], Mvkm: [1, 10] };

  function detail(f) {
    const src = sourceById().get(f.source.id) || {};
    const cat = DATA.categories.find((c) => c.id === f.category);
    const loc = [f.source.page && `${L('頁碼', 'Page')} ${f.source.page}`, f.source.table].filter(Boolean).join(' · ');
    const kv = [
      [L('年份', 'Year'), yearFmt(f)],
      [L('地區', 'Region'), pick(REGION, f.region)],
      [L('氣體', 'Gas'), gasFmt(f.gas)],
      f.gwp && [L('GWP 版本', 'GWP set'), pick(GWP, f.gwp)],
      f.gwp_used && [L('換算 GWP', 'GWP used'), f.gwp_used],
      f.scope && [L('常用範圍', 'Typical scope'), L(`範圍 ${f.scope}`, `Scope ${f.scope}`)],
      f.boundary && [L('邊界', 'Boundary'), pick(BOUNDARY, f.boundary)],
      [L('品質等級', 'Quality'), `${f.quality} · ${pick(QUALITY, f.quality)}`],
      [L('識別碼', 'ID'), f.id],
    ].filter(Boolean);
    const checks = (f.verification || []).map((v) => {
      const who = v.by.startsWith('contributor:') ? v.by.slice(12) : pick(BY, v.by);
      return `<li><span class="who">${esc(who)}</span> · ${esc(pick(METHOD, v.method))} · <span class="when">${esc(v.date)}</span>
        <div class="note">${esc(L('讀數', 'Reading'))} ${esc(v.value)}${v.page ? ` · ${esc(L('頁碼', 'Page'))} ${esc(v.page)}` : ''}</div></li>`;
    }).join('');
    const citation = `HK Open Carbon Platform (${DATA.built}). ${f.name.en}: ${f.value_text} ${f.unit}. Source: ${src.title || f.source.id}${f.source.page ? `, p. ${f.source.page}` : ''}. CC BY 4.0.`;
    const fileUrl = `https://github.com/liuxiangchen428-hash/hk-open-carbon/blob/main/${f.file}`;
    const history = isYearly(f) ? seriesItems(seriesOf(f)) : [];
    const idx = history.findIndex((x) => x.id === f.id);
    const prev = idx > 0 ? history[idx - 1] : null;
    const next = idx >= 0 && idx < history.length - 1 ? history[idx + 1] : null;
    const dl = prev && prev.value ? ((f.value - prev.value) / prev.value) * 100 : null;
    const act = splitUnit(f.unit).act;
    const presets = PRESETS[act] || [1, 10, 100];

    return `
      <div class="d-top">
        <span class="d-crumb">${esc(nm(cat?.groupName))} / ${esc(nm(cat?.name))}</span>
        <button class="d-close" type="button" data-close aria-label="${esc(L('關閉', 'Close'))}">×</button>
      </div>
      <h2 id="d-title">${esc(nm(f.name))}</h2>
      <div class="d-value">
        <span class="num">${esc(groupDigits(f.value_text))}</span>
        <span class="unit">${esc(unitFmt(f.unit))}</span>
        ${dl !== null ? `<span class="d-delta ${dl < -0.05 ? 'down' : dl > 0.05 ? 'up' : 'flat'}">${dl < -0.05 ? '↓' : dl > 0.05 ? '↑' : '→'} ${Math.abs(dl).toFixed(1)}% <em>${esc(L(`對比 ${yearFmt(prev)}`, `vs ${yearFmt(prev)}`))}</em></span>` : ''}
        ${f.unit_definition ? `<span class="unitdef">${esc(nm(f.unit_definition))}</span>` : ''}
      </div>
      <div class="d-tags">${statusTag(f.status)} ${qTag(f.quality)} <span class="chip">${esc(pick(REGION, f.region))}</span>
        ${f.tags?.includes('historical') ? `<span class="chip">${esc(L('歷史數據', 'Historical'))}</span>` : ''}
        ${f.update_frequency === 'irregular' ? `<span class="chip">${esc(L('指引常數', 'Guideline constant'))}</span>` : ''}</div>
      ${f.notes ? `<p class="d-notes">${esc(nm(f.notes))}</p>` : ''}

      <div class="d-section calc">
        <h3>${esc(L('試算', 'Quick calculation'))}</h3>
        <div class="calc-row">
          <label class="calc-field"><input id="calc-in" type="number" inputmode="decimal" min="0" step="any" placeholder="0"><span>${esc(pick(ACTIVITY, act))}</span></label>
          <span class="calc-x">× ${esc(groupDigits(f.value_text))} =</span>
          <output id="calc-out" class="calc-out"><span class="muted">${esc(L('輸入用量即時計算', 'Enter an amount to calculate'))}</span></output>
        </div>
        <div class="presets">${presets.map((p) => `<button type="button" class="pill pill-sm" data-preset="${p}">${esc(numFmt(p))} ${esc(pick(ACTIVITY, act))}</button>`).join('')}</div>
      </div>

      ${history.length > 1 ? `<div class="d-section">
        <h3 class="h-row">${esc(L('歷年變化', 'Over the years'))}
          <span class="stepper">
            <button type="button" class="pill pill-sm" ${prev ? `data-open="${esc(prev.id)}"` : 'disabled'} aria-label="${esc(L('上一年', 'Previous year'))}">←</button>
            <button type="button" class="pill pill-sm" ${next ? `data-open="${esc(next.id)}"` : 'disabled'} aria-label="${esc(L('下一年', 'Next year'))}">→</button>
          </span></h3>
        ${barChart(history, { current: f.id, height: 116 })}
      </div>` : ''}

      ${f.derivation ? `<div class="d-section"><h3>${esc(L('算式', 'Derivation'))}</h3><div class="derivation">${esc(f.derivation)}</div></div>` : ''}
      <div class="d-section">
        <h3>${esc(L('出處', 'Source'))}</h3>
        <div class="source-card">
          <div class="title">${esc(lang() === 'en' ? src.title : src.title_zh || src.title)}</div>
          <div class="pub">${esc(src.publisher)}${src.edition ? ` · ${esc(src.edition)}` : ''}</div>
          ${loc ? `<div class="loc">${esc(loc)}</div>` : ''}
          <div class="links">
            ${src.url ? `<a class="pill" href="${esc(src.url)}" target="_blank" rel="noopener">${esc(L('原文', 'Original'))} ↗</a>` : ''}
            ${src.archive_url ? `<a class="pill" href="${esc(src.archive_url)}" target="_blank" rel="noopener">${esc(L('存檔', 'Archive'))} ↗</a>` : ''}
          </div>
        </div>
      </div>
      <div class="d-section"><h3>${esc(L('資料', 'Details'))}</h3>
        <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </div>
      ${checks ? `<div class="d-section"><h3>${esc(L('核對記錄', 'Verification'))}</h3><ul class="timeline">${checks}</ul></div>` : ''}
      <div class="d-section"><h3>${esc(L('引用', 'Cite'))}</h3>
        <div class="cite">${esc(citation)}</div>
        <div class="links">
          <button class="pill pill-solid" type="button" data-copy="${esc(citation)}">${esc(L('複製引用', 'Copy citation'))}</button>
          <a class="pill" href="${esc(fileUrl)}" target="_blank" rel="noopener">${esc(L('原始資料檔', 'Data file'))} ↗</a>
        </div>
      </div>`;
  }

  /* ---------- inventory page ---------- */
  const SECTOR_KEYS = ['electricity', 'transport', 'other_fuel', 'waste', 'ippu', 'afolu'];
  const SECTOR_SHORT = {
    electricity: ['發電及能源', 'Electricity & energy'], transport: ['運輸', 'Transport'], other_fuel: ['其它燃料耗用', 'Other fuel use'],
    waste: ['廢棄物', 'Waste'], ippu: ['工業過程及產品', 'Industrial processes'], afolu: ['農業及土地', 'Agriculture & land'],
    total: ['總數', 'Total'], per_capita: ['人均（公噸）', 'Per capita (t)'], intensity: ['碳強度（千克/港元）', 'Intensity (kg/HK$)'],
  };
  const METRIC = {
    total: { label: ['溫室氣體排放總量', 'Total greenhouse gas emissions'], unit: ['千公噸二氧化碳當量', 'kilotonnes CO₂e'], short: ['千公噸', 'kt'] },
    per_capita: { label: ['人均排放', 'Per capita emissions'], unit: ['公噸二氧化碳當量 / 人', 'tonnes CO₂e per person'], short: ['公噸', 't'] },
    intensity: { label: ['碳強度', 'Carbon intensity'], unit: ['千克二氧化碳當量 / 港元本地生產總值（2023 年環比物量）', 'kg CO₂e per HK$ of GDP (chained 2023 dollars)'], short: ['千克/港元', 'kg/HK$'] },
  };
  const pct = (a, b) => ((a - b) / b) * 100;
  const arrow = (d) => (d < -0.05 ? '↓' : d > 0.05 ? '↑' : '→');
  const dcls = (d) => (d < -0.05 ? 'down' : d > 0.05 ? 'up' : 'flat');
  const pctTxt = (d) => `${arrow(d)} ${Math.abs(d).toFixed(1)}%`;
  const kt = (v) => groupDigits(String(v));

  /** Zero-based bars of the total, with the base-year level and the target as reference lines. */
  function totalChart(el, rows, { base, target, selected, onSelect, height = 280 }) {
    const draw = () => {
      const width = Math.max(280, el.clientWidth);
      const pad = { t: 22, r: 14, b: 30, l: 50 };
      const cols = [...rows.map((r) => ({ x: String(r.year), r })), ...(target ? [{ gap: true }, { x: String(target.year), target: true }] : [])];
      const max = Math.max(...rows.map((r) => r.total), base?.total ?? 0);
      const { ticks, hi, step } = niceTicks(0, max * 1.04, 4);
      const iw = width - pad.l - pad.r;
      const slot = iw / cols.length;
      const bw = Math.max(3, Math.min(26, slot - 2));
      const X = (i) => pad.l + slot * i + slot / 2;
      const Y = (v) => pad.t + (1 - v / hi) * (height - pad.t - pad.b);
      const every = slot < 38 ? 5 : 1;
      let svg = `<svg class="lc ib" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(L(...METRIC.total.label))}">`;
      for (const t of ticks) {
        svg += `<line class="lc-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/>`;
        svg += `<text class="lc-tick" x="${pad.l - 10}" y="${Y(t) + 4}" text-anchor="end">${esc(tickFmt(t, step))}</text>`;
      }
      const r4 = (x, y, w, h) => { const r = Math.min(4, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
      cols.forEach((c, i) => {
        if (c.gap) { if (slot >= 14) svg += `<text class="lc-tick" x="${X(i)}" y="${height - 8}" text-anchor="middle">…</text>`; return; }
        const cx = X(i);
        if (c.target) {
          const y = Y(target.value);
          svg += `<rect class="ib-goal" x="${cx - bw / 2}" y="${y}" width="${bw}" height="${height - pad.b - y}" rx="3"/>`;
        } else {
          const y = Y(c.r.total);
          svg += `<path class="ib-bar${c.r.year === selected ? ' on' : ''}${base && c.r.year === base.year ? ' base' : ''}" d="${r4(cx - bw / 2, y, bw, height - pad.b - y)}"/>`;
        }
        const yr = +c.x;
        const isLast = !c.target && i === rows.length - 1;
        const nearLast = every > 1 && !isLast && rows.length - 1 - i < 3;
        if (c.target || isLast || (yr % every === 0 && !nearLast)) {
          svg += `<text class="lc-tick${yr === selected ? ' sel' : ''}" x="${cx}" y="${height - 8}" text-anchor="middle">${esc(slot < 14 ? `’${c.x.slice(2)}` : c.x)}</text>`;
        }
      });
      const ref = (v, cls, text, anchorLeft) => {
        const y = Y(v);
        svg += `<line class="ib-ref ${cls}" x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}"/>`;
        svg += `<text class="ib-ref-t ${cls}" x="${anchorLeft ? pad.l + 6 : width - pad.r - 4}" y="${y - 6}" text-anchor="${anchorLeft ? 'start' : 'end'}">${esc(text)}</text>`;
      };
      if (base) ref(base.total, 'b', L(`${base.year} 年水平 ${kt(base.total)}`, `${base.year} level ${kt(base.total)}`), true);
      if (target) ref(target.value, 'g', L(`香港 ${target.year} 年目標 ${kt(target.value)}`, `HK ${target.year} target ${kt(target.value)}`), false);
      cols.forEach((c, i) => {
        if (c.gap) return;
        svg += `<rect class="lc-hit ib-hit" data-i="${i}" x="${X(i) - slot / 2}" y="${pad.t}" width="${slot}" height="${height - pad.t - pad.b}"${c.r ? ` data-year="${c.r.year}" tabindex="-1"` : ''}/>`;
      });
      svg += '</svg>';
      el.innerHTML = `${svg}<div class="lc-tip" hidden></div>`;
      const tip = $('.lc-tip', el);
      const show = (i) => {
        const c = cols[i];
        if (c.target) {
          tip.innerHTML = `<div class="y">${esc(c.x)}</div><div class="r"><span class="sw g"></span><span>${esc(L('目標', 'Target'))}</span><b>${esc(kt(target.value))}</b></div>
            <div class="r m"><span>${esc(L(`${target.base_year} 年的一半`, `Half of ${target.base_year}`))}</span></div>`;
        } else {
          const r = c.r;
          const top = SECTOR_KEYS.reduce((a, k) => (r[k] > r[a] ? k : a));
          tip.innerHTML = `<div class="y">${esc(c.x)}</div>
            <div class="r"><span class="sw s1"></span><span>${esc(L('總排放', 'Total'))}</span><b>${esc(kt(r.total))}</b></div>
            ${base && r.year !== base.year ? `<div class="r"><span>${esc(L(`對比 ${base.year}`, `vs ${base.year}`))}</span><b>${esc(pctTxt(pct(r.total, base.total)))}</b></div>` : ''}
            <div class="r m"><span>${esc(L('最大來源', 'Largest'))}</span><b>${esc(L(...SECTOR_SHORT[top]))}</b></div>`;
        }
        tip.hidden = false;
        tip.style.left = `${Math.min(Math.max(X(i), 90), width - 90)}px`;
        $$('.ib-bar', el).forEach((b, j) => b.classList.toggle('hover', j === i));
      };
      $$('.ib-hit', el).forEach((h) => {
        h.addEventListener('mouseenter', () => show(+h.dataset.i));
        if (h.dataset.year) h.addEventListener('click', () => onSelect(+h.dataset.year));
      });
      $('svg', el).addEventListener('mouseleave', () => { tip.hidden = true; $$('.ib-bar', el).forEach((b) => b.classList.remove('hover')); });
    };
    draw();
    if (!el._ro) {
      let w = el.clientWidth;
      el._ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; el._redraw?.(); } });
      el._ro.observe(el);
    }
    el._redraw = draw;
  }

  /** Small single-series trend line for a sector row. */
  function spark(values, years, selected, { w = 120, h = 30 } = {}) {
    const max = Math.max(...values), min = Math.min(...values);
    const X = (i) => 2 + (i * (w - 4)) / Math.max(1, values.length - 1);
    const Y = (v) => 3 + (1 - (v - min) / (max - min || 1)) * (h - 6);
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const si = years.indexOf(selected);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}"/>${si >= 0 ? `<circle cx="${X(si).toFixed(1)}" cy="${Y(values[si]).toFixed(1)}" r="3"/>` : ''}</svg>`;
  }

  function initInventory() {
    const table = DATA.inventory?.[0];
    if (!table) return;
    const all = table.rows;
    const latest = all.at(-1);
    const base = all.find((r) => r.year === (table.targets?.[0]?.base_year ?? 2005));
    const tg = table.targets?.[0];
    const target = tg && base ? { ...tg, value: Math.round(base.total * (1 - tg.reduction)) } : null;
    const st = { metric: 'total', from: 2005, year: latest.year, view: 'bars' };
    const src = sourceById();

    function renderKpis() {
      const r = all.find((x) => x.year === st.year) ?? latest;
      const remain = target ? r.total - target.value : 0;
      const done = target ? (base.total - r.total) / (base.total - target.value) : 0;
      const yearsLeft = target ? target.year - r.year : 0;
      // Average yearly cut needed from the selected year to reach the target (computed here, not published).
      const perYear = target && yearsLeft > 0 && remain > 0 ? (1 - Math.pow(target.value / r.total, 1 / yearsLeft)) * 100 : 0;
      const sel = r.year !== latest.year ? `<em class="ik-sel">${esc(L('所選年份', 'Selected year'))}</em>` : '';
      $('#inv-kpis').innerHTML = `
        <div class="ik"><span>${esc(L(`${r.year} 年總排放`, `Total, ${r.year}`))}${sel}</span><b>${esc(kt(r.total))}</b><i>${esc(L(...METRIC.total.unit))}</i></div>
        <div class="ik"><span>${esc(L(`對比 ${base.year} 年`, `vs ${base.year}`))}</span><b class="delta-ink ${dcls(pct(r.total, base.total))}">${esc(r.year === base.year ? '—' : pctTxt(pct(r.total, base.total)))}</b><i>${esc(L(`${base.year} 年為 ${kt(base.total)}`, `${base.year}: ${kt(base.total)}`))}</i></div>
        <div class="ik"><span>${esc(L(`${r.year} 年人均排放`, `Per capita, ${r.year}`))}</span><b>${esc(r.per_capita.toFixed(2))}</b><i>${esc(L(...METRIC.per_capita.unit))}</i></div>
        ${target ? `<div class="ik ik-goal"><span>${esc(L(`距香港 ${target.year} 年目標`, `To HK's ${target.year} target`))}</span>
          <b>${esc(remain > 0 ? kt(remain) : L('已達標', 'Met'))}</b>
          <i>${esc(remain > 0 ? L(`千公噸尚待減少（目標 ${kt(target.value)}，即 ${base.year} 年的一半）`, `kt still to cut (target ${kt(target.value)}, half of ${base.year})`) : L(`低於目標 ${kt(-remain)} 千公噸`, `${kt(-remain)} kt below target`))}</i>
          <span class="goal-bar" role="img" aria-label="${esc(L(`已完成 ${Math.round(done * 100)}%`, `${Math.round(done * 100)}% of the way`))}"><span style="width:${Math.max(0, Math.min(100, done * 100)).toFixed(1)}%"></span></span>
          <i>${esc(L(`由 ${base.year} 年起計已完成 ${Math.max(0, Math.round(done * 100))}%`, `${Math.max(0, Math.round(done * 100))}% of the way since ${base.year}`))}${perYear ? esc(L(`；${r.year}–${target.year} 年平均每年要減 ${perYear.toFixed(1)}%`, `; needs about ${perYear.toFixed(1)}% a year, ${r.year}–${target.year}`)) : ''}</i></div>` : ''}`;
      const ng = table.targets?.find((x) => x.kind === 'neutrality');
      $('#inv-goal-note').innerHTML = target ? esc(L(
        `香港政府《香港氣候行動藍圖2050》的目標：${target.year} 年前把總碳排放從 ${base.year} 年水平減半${ng ? `，${ng.year} 年前實現碳中和` : ''}。`,
        `Hong Kong Government targets (Climate Action Plan 2050): halve total emissions from the ${base.year} level before ${target.year}${ng ? ` and reach carbon neutrality before ${ng.year}` : ''}.`)) : '';
    }

    function renderChart() {
      const rows = all.filter((r) => r.year >= st.from);
      const m = METRIC[st.metric];
      $('#inv-title').textContent = L(...m.label);
      $('#inv-sub').textContent = `${L(...m.unit)} · ${rows[0].year}–${latest.year}`;
      $$('#inv-metric button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === st.metric)));
      $$('#inv-range button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.from === st.from)));
      const el = $('#inv-chart');
      el._redraw = null;
      if (st.metric === 'total') {
        totalChart(el, rows, { base, target, selected: st.year, onSelect: (y) => { st.year = y; renderKpis(); renderChart(); renderSectors(); } });
      } else {
        const dec = st.metric === 'intensity' ? 3 : 2;
        lineChart(el, [{ label: L(...m.label), cls: 's1', points: rows.map((r) => ({ x: String(r.year), value: r[st.metric], text: r[st.metric].toFixed(dec) })) }]);
      }
      const first = rows[0];
      const cur = all.find((x) => x.year === st.year) ?? latest;
      const prev = all.find((x) => x.year === cur.year - 1);
      const v = (r) => r[st.metric];
      const fmtv = (n) => (st.metric === 'total' ? kt(n) : n.toFixed(st.metric === 'intensity' ? 3 : 2));
      $('#inv-foot').innerHTML = `
        <div class="kpis">
          <div><span>${esc(L(`${cur.year} 年`, String(cur.year)))}</span><b>${esc(fmtv(v(cur)))}</b></div>
          ${prev ? `<div><span>${esc(L(`對比 ${prev.year}`, `vs ${prev.year}`))}</span><b class="delta-ink ${dcls(pct(v(cur), v(prev)))}">${esc(pctTxt(pct(v(cur), v(prev))))}</b></div>` : ''}
          ${cur.year !== first.year ? `<div><span>${esc(L(`${first.year} 至 ${cur.year}`, `${first.year} to ${cur.year}`))}</span><b class="delta-ink ${dcls(pct(v(cur), v(first)))}">${esc(pctTxt(pct(v(cur), v(first))))}</b></div>` : ''}
          ${st.metric === 'total' ? '' : `<div><span>${esc(L('峰值', 'Peak'))}</span><b>${esc(fmtv(Math.max(...rows.map(v))))} · ${esc(String(rows.reduce((a, r) => (v(r) > v(a) ? r : a)).year))}</b></div>`}
        </div>
        ${st.metric === 'total' && target ? `<p class="inv-legend"><span class="sw b"></span>${esc(L(`${base.year} 年水平`, `${base.year} level`))}<span class="sw g"></span>${esc(L(`香港 ${target.year} 年目標（${base.year} 年的一半）`, `HK ${target.year} target (half of ${base.year})`))}<span class="muted-b">${esc(L('點選柱可查看該年分項', 'Click a bar for its breakdown'))}</span></p>` : ''}`;
    }

    function renderSectors() {
      const r = all.find((x) => x.year === st.year) ?? latest;
      const rows = all.filter((x) => x.year >= st.from);
      const years = rows.map((x) => x.year);
      $('#sec-year').textContent = L(`${r.year} 年 · 千公噸二氧化碳當量`, `${r.year} · kt CO₂e`);
      $$('#sec-view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
      const out = $('#inv-sectors');
      if (st.view === 'table') {
        const cols = ['year', ...Object.keys(table.columns)];
        out.innerHTML = `<div class="table-wrap inv-table"><table class="sources-table">
          <thead><tr>${cols.map((c) => `<th>${esc(c === 'year' ? L('年份', 'Year') : L(SECTOR_SHORT[c]?.[0] ?? table.columns[c]['zh-Hant'], SECTOR_SHORT[c]?.[1] ?? table.columns[c].en))}</th>`).join('')}</tr></thead>
          <tbody>${[...all].reverse().map((x) => `<tr${x.year === r.year ? ' class="on"' : ''}>${cols.map((c) => `<td>${esc(c === 'year' ? String(x[c]) : c === 'per_capita' ? x[c].toFixed(2) : c === 'intensity' ? x[c].toFixed(3) : kt(x[c]))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="muted inv-dl"><a class="pill" href="api/v1/${esc(table.file)}" download>${esc(L('下載 CSV', 'Download CSV'))} ↓</a></p>`;
        return;
      }
      const max = Math.max(...SECTOR_KEYS.map((k) => r[k]));
      out.innerHTML = `<div class="sec-list">${SECTOR_KEYS.map((k) => {
        const share = (r[k] / r.total) * 100;
        const ch = base && r.year !== base.year ? pct(r[k], base[k]) : null;
        return `<div class="sec-row">
          <div class="sec-name">${esc(L(...SECTOR_SHORT[k]))}${nm(table.columns[k]) !== L(...SECTOR_SHORT[k]) ? `<small>${esc(nm(table.columns[k]))}</small>` : ''}</div>
          <div class="sec-bar"><span style="width:${((r[k] / max) * 100).toFixed(1)}%"></span></div>
          <div class="sec-val">${esc(kt(r[k]))}<small>${share < 1 ? '<1' : share.toFixed(0)}%</small></div>
          <div class="sec-ch">${ch === null ? '<span class="muted">—</span>' : `<span class="delta-ink ${dcls(ch)}">${esc(pctTxt(ch))}</span><small>${esc(L(`對比 ${base.year}`, `vs ${base.year}`))}</small>`}</div>
          <div class="sec-spark">${spark(rows.map((x) => x[k]), years, r.year)}</div>
        </div>`;
      }).join('')}</div>
      <p class="muted inv-small">${esc(L('百分比為佔當年總排放的比例；分項以三個有效數字公佈，相加可能與總數略有出入。', 'Shares are of that year’s total. Sectors are published to three significant figures and may not add up exactly.'))}</p>`;
    }

    function renderNotes() {
      const statusLine = table.status === 'reviewed' ? L('已由維護者核對。', 'Checked by the maintainer.') : L('草稿：AI 助手已從原文讀取，待維護者核對。', 'Draft: read from the source by the AI assistant, awaiting the maintainer’s check.');
      $('#inv-about').innerHTML = `
        <p>${esc(nm(table.notes))}</p>
        <p>${esc(L('「其它燃料耗用」指商業、工業及住宅處所的燃料燃燒。', '“Other end use of fuel” is fuel burned in commercial, industrial and domestic premises.'))}</p>
        ${target ? `<p>${esc(L(`目標線 = ${base.year} 年總排放 × ${1 - target.reduction}，由本平台按公佈數字計算。「每年要減」是按所選年份至 ${target.year} 年平均計算，同樣由本平台計算，不是政府公佈的數字。`, `Target line = ${base.year} total × ${1 - target.reduction}, computed by the platform from the published figures. The yearly cut needed is an average from the selected year to ${target.year}, also computed by the platform, not a government figure.`))}</p>` : ''}
        <p>${statusTag(table.status)} ${esc(statusLine)}</p>`;
      const pages = { ...table.pages };
      const items = Object.keys(pages).map((id) => ({ id, page: pages[id] }));
      if (tg) items.push({ id: tg.source, page: tg.page, quote: tg.quote });
      $('#inv-sources').innerHTML = items.map((it) => {
        const s = src.get(it.id);
        if (!s) return '';
        return `<div class="inv-src">
          <p class="doc-title">${esc(lang() === 'en' ? s.title : s.title_zh || s.title)}</p>
          <p class="muted">${esc(s.publisher)} · ${esc(s.edition)} · ${esc(L('頁', 'p.'))} ${esc(String(it.page))}</p>
          ${it.quote ? `<blockquote>“${esc(it.quote)}”</blockquote>` : ''}
          <div class="links">
            ${s.url ? `<a class="pill" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(L('原文', 'Original'))} ↗</a>` : ''}
            ${s.archive_url ? `<a class="pill" href="${esc(s.archive_url)}" target="_blank" rel="noopener">${esc(L('存檔', 'Archive'))} ↗</a>` : ''}
          </div></div>`;
      }).join('');
    }

    const all4 = () => { renderKpis(); renderChart(); renderSectors(); renderNotes(); };
    $('#inv-metric').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.metric = b.dataset.metric; renderChart(); } });
    $('#inv-range').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.from = +b.dataset.from; if (st.year < st.from) st.year = latest.year; renderKpis(); renderChart(); renderSectors(); } });
    $('#sec-view').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.view = b.dataset.view; renderSectors(); } });
    all4();
    rerender.push(all4);
  }

  /* ---------- household calculator ---------- */
  const HH_SERIES = {
    clp: 'hk.energy.electricity.clp', hke: 'hk.energy.electricity.hke',
    gasProd: 'hk.energy.town-gas.purchased', gasComb: 'hk.energy.town-gas.combustion-co2e',
    water: 'hk.water.fresh-water.wsd', sewage: 'hk.water.sewage.dsd',
    mtr: 'hk.transport.rail.mtr-co2-per-pkm', bus: 'hk.transport.bus.tih-per-trip',
  };
  const HH_FUEL = { petrol: 'hk.energy.fuel.petrol.mobile.co2.emsd2010', diesel: 'hk.energy.fuel.diesel.mobile.co2.emsd2010' };
  const MASS_KG = { g: 0.001, kg: 1, t: 1000 };
  // GWPs the 2010 guidelines use to convert CH4 and N2O (IPCC AR2; guidelines p.27 and p.29, Note 4).
  const AR2_GWP = { CH4: 21, N2O: 310 };
  const HH_KEY = 'hkoc-calc';
  const HH_PERIOD = { 1: ['每月', 'per month'], 2: ['每兩個月', 'every 2 months'], 4: ['每四個月', 'every 4 months'], 12: ['全年', 'whole year'] };

  /** Reviewed factor of a series for the bill year: same year, else the latest earlier one, else the earliest. */
  function factorFor(series, year) {
    const items = seriesItems(series, { recent: true }).filter((f) => f.status === 'reviewed');
    if (!items.length) return null;
    return items.find((f) => f.year === year) ?? [...items].reverse().find((f) => f.year < year) ?? items[0];
  }

  function initCalculator() {
    const form = $('#hh-form');
    if (!form) return;
    const st = { people: 1, year: null, supplier: 'clp', kwh: '', gas: '', water: '', p_kwh: 1, p_gas: 1, p_water: 1, sewage: true, mtrTrips: '', mtrKm: '', bus: '', fuel: '', fuelType: 'petrol' };
    try { Object.assign(st, JSON.parse(localStorage.getItem(HH_KEY) || '{}')); } catch {}
    const save = () => { try { localStorage.setItem(HH_KEY, JSON.stringify(st)); } catch {} };
    const inv = DATA.inventory?.[0];
    const hkLatest = inv?.rows.at(-1);
    const srcs = sourceById();

    const years = () => seriesItems(HH_SERIES[st.supplier], { recent: true }).filter((f) => f.status === 'reviewed').map((f) => f.year).reverse();
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };
    const kgFmt = (n) => numFmt(Math.round(n), 0);
    const tFmt = (n) => numFmt(n / 1000, 2);

    function fillControls() {
      const ys = years();
      if (!ys.includes(st.year)) st.year = ys[0];
      $('#hh-year').innerHTML = ys.map((y) => `<option value="${y}"${y === st.year ? ' selected' : ''}>${y}</option>`).join('');
      $('#hh-people').value = st.people;
      $('#hh-kwh').value = st.kwh; $('#hh-gas').value = st.gas; $('#hh-water').value = st.water;
      $('#hh-sewage').checked = st.sewage;
      $('#hh-mtr-trips').value = st.mtrTrips; $('#hh-mtr-km').value = st.mtrKm; $('#hh-bus').value = st.bus;
      $('#hh-fuel').value = st.fuel; $('#hh-fuel-type').value = st.fuelType;
      const missing = ['mtr', 'bus'].filter((k) => !factorFor(HH_SERIES[k], st.year));
      $$('[data-needs]', form).forEach((i) => { i.disabled = missing.includes(i.dataset.needs); });
      const pend = $('#hh-pending');
      pend.hidden = !missing.length;
      pend.textContent = L(`${missing.map((k) => (k === 'mtr' ? '港鐵' : '巴士')).join('、')}系數仍待維護者核對，暫不計算。`, `${missing.map((k) => (k === 'mtr' ? 'MTR' : 'Bus')).join(' and ')} factors are awaiting the maintainer’s check and are not counted yet.`);
      $$('.calc-period', form).forEach((s) => {
        s.innerHTML = Object.entries(HH_PERIOD).map(([v, l]) => `<option value="${v}">${esc(L(...l))}</option>`).join('');
        s.value = String(st[`p_${s.dataset.period}`]);
      });
      $$('#hh-supplier button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.supplier === st.supplier)));
    }

    function lines() {
      const y = st.year;
      const annual = (q, p) => num(q) * (12 / p);
      const out = [];
      const add = (key, name, qty, unit, series, extra) => {
        const f = factorFor(series, y);
        if (!f) return;
        out.push({ key, name, qty, unit, f, kg: qty * f.value * (MASS_KG[splitUnit(f.unit).mass] ?? 1), ...extra });
      };
      const kwh = annual(st.kwh, st.p_kwh), gas = annual(st.gas, st.p_gas), water = annual(st.water, st.p_water);
      add('elec', st.supplier === 'clp' ? ['用電（中電）', 'Electricity (CLP)'] : ['用電（港燈）', 'Electricity (HK Electric)'], kwh, 'kWh', HH_SERIES[st.supplier], { group: 'e' });
      add('gasComb', ['煤氣燃燒（家中爐具）', 'Town gas burned at home'], gas, 'unit', HH_SERIES.gasComb, { group: 'g' });
      add('gasProd', ['煤氣生產', 'Town gas production'], gas, 'unit', HH_SERIES.gasProd, { group: 'g' });
      add('water', ['食水處理及供應', 'Fresh water supply'], water, 'm3', HH_SERIES.water, { group: 'w' });
      if (st.sewage) add('sewage', ['污水處理', 'Sewage treatment'], water, 'm3', HH_SERIES.sewage, { group: 'w' });
      add('mtr', ['港鐵', 'MTR'], num(st.mtrTrips) * num(st.mtrKm) * 52, 'pkm', HH_SERIES.mtr, { group: 't' });
      add('bus', ['巴士', 'Bus'], num(st.bus) * 52, 'trip', HH_SERIES.bus, { group: 't' });
      const fuelF = DATA.factors.find((f) => f.id === HH_FUEL[st.fuelType] && f.status === 'reviewed');
      const carL = num(st.fuel) * 12;
      const carName = st.fuelType === 'petrol' ? ['私家車（汽油）', 'Car (petrol)'] : ['私家車（柴油）', 'Car (diesel)'];
      if (fuelF) out.push({ key: 'car', name: [`${carName[0]} 二氧化碳`, `${carName[1]} CO₂`], qty: carL, unit: 'L', f: fuelF, kg: carL * fuelF.value, group: 't', fixed: true });
      for (const g of ['CH4', 'N2O']) {
        const f = DATA.factors.find((x) => x.id === `hk.energy.fuel.${st.fuelType}.mobile-passenger-car.${g.toLowerCase()}.emsd2010` && x.status === 'reviewed');
        if (f) out.push({ key: `car-${g}`, name: [`${carName[0]} ${g === 'CH4' ? '甲烷' : '氧化亞氮'}`, `${carName[1]} ${gasFmt(g)}`], qty: carL, unit: 'L', f, gwp: AR2_GWP[g], kg: carL * f.value * MASS_KG.g * AR2_GWP[g], group: 't', fixed: true });
      }
      return out;
    }

    function renderResult() {
      const ls = lines();
      const total = ls.reduce((a, l) => a + l.kg, 0);
      const people = Math.max(1, Math.round(num(st.people)) || 1);
      const per = total / people;
      const max = Math.max(...ls.map((l) => l.kg), 1);
      const hkPer = hkLatest ? hkLatest.per_capita * 1000 : 0;
      const cmpMax = Math.max(per, hkPer, 1);
      const empty = total === 0;
      $('#hh-result').innerHTML = `
        <div class="hr-head">
          <span class="hr-label">${esc(L('全家每年', 'Household per year'))}</span>
          <div class="hr-total"><b>${esc(tFmt(total))}</b><span>${esc(L('公噸二氧化碳當量', 't CO₂e'))}</span></div>
          <p class="hr-sub">${esc(L(`即 ${kgFmt(total)} 千克 · 每人 ${tFmt(per)} 公噸（${people} 人）`, `${kgFmt(total)} kg · ${tFmt(per)} t per person (${people} ${people === 1 ? 'person' : 'people'})`))}</p>
        </div>
        ${empty ? `<p class="hr-empty">${esc(L('在左邊填上帳單用量，結果會即時顯示。', 'Enter the usage from your bills; the result updates as you type.'))}</p>` : `
        <div class="hr-bars">${ls.filter((l) => l.kg > 0).map((l) => `
          <div class="hr-bar"><span class="n"><i class="hh-ico ${l.group}"></i>${esc(L(...l.name))}</span>
            <span class="v">${esc(kgFmt(l.kg))} <small>kg</small></span>
            <span class="p">${total ? ((l.kg / total) * 100).toFixed(0) : 0}%</span>
            <span class="t"><span style="width:${((l.kg / max) * 100).toFixed(1)}%"></span></span></div>`).join('')}
        </div>`}
        ${hkLatest ? `
        <div class="hr-cmp">
          <p class="hr-cmp-t">${esc(L('每人每年，公噸', 'Per person per year, tonnes'))}</p>
          <div class="cmp-row you"><span>${esc(L('你家（以上已填項目）', 'Your household (items entered)'))}</span><b>${esc(tFmt(per))}</b>
            <span class="t"><span style="width:${((per / cmpMax) * 100).toFixed(1)}%"></span></span></div>
          <div class="cmp-row hk"><span>${esc(L(`全港人均（${hkLatest.year} 年，所有排放）`, `Hong Kong average (${hkLatest.year}, all emissions)`))}</span><b>${esc(hkLatest.per_capita.toFixed(2))}</b>
            <span class="t"><span style="width:${((hkPer / cmpMax) * 100).toFixed(1)}%"></span></span></div>
          <p class="hr-note">${esc(L('全港人均包括交通、工商業、廢物等所有本地排放，不只家居；兩者不是同一範圍，只作參考。', 'The Hong Kong figure covers all local emissions — transport, business, waste and more — not just homes, so this is a rough reference, not a like-for-like comparison.'))}</p>
        </div>` : ''}`;
    }

    function renderLines() {
      const all = lines();
      const filled = all.filter((l) => l.qty > 0);
      const ls = filled.length ? filled : all;
      const actName = { kWh: ['度', 'kWh'], unit: ['單位', 'units'], m3: ['立方米', 'm³'], pkm: ['乘客公里', 'passenger-km'], trip: ['程', 'trips'], L: ['公升', 'litres'] };
      $('#hh-lines').innerHTML = `<div class="hh-lines">${ls.map((l) => {
        const fy = yearFmt(l.f);
        const other = !l.fixed && l.f.year !== st.year;
        return `<div class="hl">
          <div class="hl-name"><i class="hh-ico ${l.group}"></i>${esc(L(...l.name))}</div>
          <div class="hl-calc">
            <span>${esc(numFmt(l.qty, 1))} ${esc(L(...actName[l.unit]))}</span><span class="op">×</span>
            <a href="index.html#f=${encodeURIComponent(l.f.id)}" title="${esc(nm(l.f.name))}">${esc(l.f.value_text)} <small>${esc(emissionFmt(l.f.unit))}/${esc(L(...actName[l.unit]))}</small></a>${l.gwp ? `<span class="op">×</span><span title="${esc(L('全球暖化潛勢（2010 年指引採用 IPCC 第二次評估報告數值）', 'Global warming potential (IPCC AR2 values used by the 2010 guidelines)'))}">${l.gwp} <small>GWP</small></span>` : ''}<span class="op">=</span>
            <b>${esc(kgFmt(l.kg))} kg</b>
          </div>
          <div class="hl-meta">${esc(L(`系數年份 ${fy}`, `Factor year ${fy}`))}${l.f.quality === 'D' ? ` · ${esc(L('推算值（D 級）', 'Derived value (quality D)'))}` : ''}${l.f.gas === 'CO2' && l.key !== 'car' ? ` · ${esc(L('只計二氧化碳', 'CO₂ only'))}` : ''}${other ? ` · <span class="warn">${esc(L(`沒有 ${st.year} 年的系數，用最接近的 ${fy}`, `No ${st.year} factor; using ${fy}`))}</span>` : ''}</div>
        </div>`;
      }).join('')}</div>
      <p class="muted inv-small">${esc(L('用量按帳單涵蓋的月數換算成全年：例如兩個月的帳單 × 6。點系數可查看出處和核對紀錄。', 'Usage is scaled to a year from the billing period, e.g. a two-month bill × 6. Click a factor to see its source and checks.'))}</p>`;
    }

    function renderNotes() {
      $('#hh-scope').innerHTML = `
        <p>${esc(L('計算家中用電、煤氣和食水帶來的排放：', 'Counts the emissions from the electricity, town gas and water your home uses:'))}</p>
        <ul>
          <li>${esc(L('用電：電力公司公佈的售電排放強度（按供電區）。', 'Electricity: the supplier’s published emission intensity of electricity sold, by supply area.'))}</li>
          <li>${esc(L('煤氣：家中燃燒加上煤氣生產，兩者都由煤氣公司公佈。', 'Town gas: burning at home plus production, both published by the gas company.'))}</li>
          <li>${esc(L('食水及污水：水務署、渠務署處理和輸送用的電力；住宅污水按用水量 100% 計，是政府碳審計範本的預設做法。', 'Water and sewage: electricity used by the Water Supplies and Drainage Services Departments; household sewage is counted as 100% of water used, the default in the government carbon audit template.'))}</li>
          <li>${esc(L('交通：港鐵按乘客公里（只計二氧化碳）；巴士按每程（九巴及龍運的推算平均值；城巴沒有公佈排放數據，乘城巴時只能作近似）；私家車按入油量（二氧化碳，加上私家車類別的甲烷和氧化亞氮，2010 年指引，按 GWP 21 及 310 換算）。每週車程 × 52 換算全年。', 'Transport: MTR per passenger-km (CO₂ only); bus per trip (a derived KMB and Long Win average; Citybus publishes no emissions data, so for Citybus it is only an approximation); car by fuel bought (CO₂ plus passenger-car CH₄ and N₂O, 2010 guidelines, converted with GWP 21 and 310). Weekly trips × 52 for a year.'))}</li>
        </ul>
        <p>${esc(L('不包括飛行、的士、小巴、電車、渡輪、飲食、購物和廢物（這些交通工具的營運商沒有公佈可用的排放數據），所以結果會比一個人的完整碳足跡低。只使用已經過維護者核對的系數。', 'Flights, taxis, minibuses, trams, ferries, food, shopping and waste are not included (their operators publish no usable emissions data), so the result is lower than a full personal footprint. Only factors checked by the maintainer are used.'))}</p>`;
      const ls = lines();
      const seen = new Set();
      $('#hh-factors').innerHTML = ls.filter((l) => !seen.has(l.f.id) && seen.add(l.f.id)).map((l) => {
        const s = srcs.get(l.f.source.id);
        return `<div class="inv-src">
          <p class="doc-title"><a href="index.html#f=${encodeURIComponent(l.f.id)}">${esc(nm(l.f.name))}</a></p>
          <p class="muted">${esc(l.f.value_text)} ${esc(unitFmt(l.f.unit))} · ${s ? esc(lang() === 'en' ? s.title : s.title_zh || s.title) : ''}${l.f.source.page ? ` · ${esc(L('頁', 'p.'))} ${esc(String(l.f.source.page))}` : ''}</p>
        </div>`;
      }).join('');
    }

    const renderAll = () => { renderResult(); renderLines(); renderNotes(); };
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.id === 'hh-people') st.people = el.value;
      else if (el.id === 'hh-kwh') st.kwh = el.value;
      else if (el.id === 'hh-gas') st.gas = el.value;
      else if (el.id === 'hh-water') st.water = el.value;
      else if (el.id === 'hh-year') { st.year = +el.value; fillControls(); }
      else if (el.id === 'hh-sewage') st.sewage = el.checked;
      else if (el.id === 'hh-mtr-trips') st.mtrTrips = el.value;
      else if (el.id === 'hh-mtr-km') st.mtrKm = el.value;
      else if (el.id === 'hh-bus') st.bus = el.value;
      else if (el.id === 'hh-fuel') st.fuel = el.value;
      else if (el.id === 'hh-fuel-type') st.fuelType = el.value;
      else if (el.dataset.period) st[`p_${el.dataset.period}`] = +el.value;
      save(); renderAll();
    });
    form.addEventListener('click', (e) => {
      const sup = e.target.closest('[data-supplier]');
      if (sup) { st.supplier = sup.dataset.supplier; fillControls(); save(); renderAll(); return; }
      if (e.target.closest('[data-example]')) {
        // Illustrative numbers only; not a typical or average household.
        Object.assign(st, { people: 3, kwh: '550', p_kwh: 2, gas: '60', p_gas: 2, water: '40', p_water: 4, sewage: true, mtrTrips: '10', mtrKm: '12', bus: '4', fuel: '', fuelType: 'petrol' });
        fillControls(); save(); renderAll(); return;
      }
      if (e.target.closest('[data-clear]')) {
        Object.assign(st, { people: 1, kwh: '', gas: '', water: '', p_kwh: 1, p_gas: 1, p_water: 1, sewage: true, mtrTrips: '', mtrKm: '', bus: '', fuel: '', fuelType: 'petrol' });
        fillControls(); save(); renderAll();
      }
    });
    fillControls();
    renderAll();
    rerender.push(() => { fillControls(); renderAll(); });
  }

  /* ---------- sources page ---------- */
  function initSources() {
    const tbody = $('#sources-body');
    const sq = $('#sq');
    const usedOnly = $('#used-only');
    function render() {
      sq.placeholder = L('搜尋文件或機構', 'Search documents or publishers');
      const words = sq.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const rows = DATA.sources
        .filter((s) => s.type !== 'terms')
        .filter((s) => !usedOnly.checked || s.used)
        .filter((s) => {
          const hay = [s.id, s.title, s.title_zh, s.publisher, s.edition].join(' ').toLowerCase();
          return words.every((w) => hay.includes(w));
        });
      tbody.innerHTML = rows.map((s) => `
        <tr>
          <td><div class="doc-title">${esc(lang() === 'en' ? s.title : s.title_zh || s.title)}</div>
              <div class="doc-zh">${esc(lang() === 'en' ? s.title_zh : s.title)}</div></td>
          <td>${esc(s.publisher)}</td>
          <td class="ed">${esc(s.edition)}</td>
          <td><div class="links">
            ${s.url ? `<a class="pill" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(L('原文', 'Original'))} ↗</a>` : ''}
            ${s.archive_url ? `<a class="pill" href="${esc(s.archive_url)}" target="_blank" rel="noopener">${esc(L('存檔', 'Archive'))} ↗</a>` : ''}
          </div></td>
        </tr>`).join('') || `<tr><td colspan="4" class="muted">${esc(L('沒有符合條件的來源。', 'No matching sources.'))}</td></tr>`;
    }
    sq.addEventListener('input', render);
    usedOnly.addEventListener('change', render);
    rerender.push(render);
    render();
  }
})();
