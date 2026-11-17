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
    return (i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i) + (d !== undefined ? `.${d}` : '');
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
      for (const x of xs) svg += `<text class="lc-tick" x="${X(x)}" y="${height - 8}" text-anchor="middle">${esc(x)}</text>`;
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
      el._ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(); } });
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
  const page = document.body.dataset.page;
  if (page === 'index') dataReady.then(() => { initDash(); initBrowser(); });
  if (page === 'sources') dataReady.then(initSources);

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
