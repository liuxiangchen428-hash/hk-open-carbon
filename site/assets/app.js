/* HK Open Carbon Platform — browser script (no dependencies). */
(() => {
  'use strict';

  const html = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
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

  /* ---------- labels ---------- */
  const REGION = {
    HK: ['全港', 'Hong Kong'],
    'HK-CLP': ['中電供電區', 'CLP supply area'],
    'HK-HKE': ['港燈供電區', 'HK Electric area'],
    GLOBAL: ['國際', 'International'],
  };
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
  function unitFmt(unit) {
    const [em, act] = unit.split('/');
    const m = em.match(/^(kg|g|t)(.+)$/);
    const mass = m ? m[1] : '';
    return `${mass} ${gasFmt(m ? m[2] : em)} / ${pick(ACTIVITY, act)}`;
  }
  const yearFmt = (f) => (f.tags?.includes('fiscal-year') ? `${f.year}/${String((f.year + 1) % 100).padStart(2, '0')}` : String(f.year));
  const groupDigits = (s) => {
    const [i, d] = s.split('.');
    return (i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i) + (d !== undefined ? `.${d}` : '');
  };
  const statusTag = (s) => `<span class="status ${esc(s)}">${esc(pick(STATUS, s))}</span>`;
  const qTag = (q) => `<span class="q q-${esc(q)}" title="${esc(pick(QUALITY, q))}">${esc(q)}</span>`;

  /* ---------- data ---------- */
  let DATA;
  const dataReady = fetch('assets/data.json').then((r) => r.json()).then((d) => (DATA = d));
  const sourceById = () => new Map(DATA.sources.map((s) => [s.id, s]));

  // Rows are grouped into cards:
  //  - yearly:  one series over years (id ends in .YYYY)       -> rows by year, with a trend bar
  //  - gas:     CO2 / CH4 / N2O of the same fuel and use       -> rows by gas
  //  - names:   sibling factors such as IPCC defaults          -> rows by their distinguishing name
  //  - single:  anything else
  const GAS_SEG = /\.(co2|ch4|n2o)(?=\.|$)/;
  function groupOf(f) {
    if (/\.\d{4}$/.test(f.id)) return { key: f.id.replace(/\.\d{4}$/, ''), kind: 'yearly' };
    if (GAS_SEG.test(f.id)) return { key: f.id.replace(GAS_SEG, '').replace(/\.mobile-(litre|kg)/, '.mobile'), kind: 'gas' };
    if (f.tags?.includes('ipcc-default')) return { key: `ipcc:${f.category}`, kind: 'names' };
    return { key: f.id, kind: 'single' };
  }
  const stripYear = (s, y) => s.replace(new RegExp(`\\s*[（(][^（）()]*${y}[^（）()]*[）)]\\s*$`), '').trim();
  const stripGas = (s) => s.replace(/(二氧化碳|甲烷|氧化亞氮)/g, '').replace(/\s(CO2|CH4|N2O)\b/g, '').replace(/\s{2,}/g, ' ').trim();
  // Longest common suffix of several names, cut at a word boundary for English.
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
  if (page === 'index') dataReady.then(initBrowser);
  if (page === 'sources') dataReady.then(initSources);

  function initBrowser() {
    const state = { cat: 'all', status: 'all', q: '' };
    const q = $('#q');
    const catList = $('#cat-list');
    const groupsEl = $('#groups');
    const countEl = $('#count');
    const emptyEl = $('#empty');

    const placeholder = () => { q.placeholder = L('搜尋系數，例如 柴油', 'Search, e.g. diesel'); };

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
        if (c.group !== lastGroup) {
          out += `<li><p class="group-label">${esc(nm(c.groupName))}</p></li>`;
          lastGroup = c.group;
        }
        out += `<li><button type="button" data-cat="${esc(c.id)}" aria-pressed="${state.cat === c.id}"><span>${esc(nm(c.name))}</span><span class="n">${counts.get(c.id)}</span></button></li>`;
      }
      catList.innerHTML = out;
    }

    function render() {
      placeholder();
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
          if (!cards.has(g.key)) cards.set(g.key, { kind: g.kind, items: [] });
          cards.get(g.key).items.push(f);
        }
        // Newest data first; then local before international; then by title.
        const ordered = [...cards.values()].sort((a, b) =>
          Math.max(...b.items.map((x) => x.year)) - Math.max(...a.items.map((x) => x.year)) ||
          a.items[0].quality.localeCompare(b.items[0].quality) ||
          nm(a.items[0].name).localeCompare(nm(b.items[0].name)));
        out += `<section class="group"><div class="group-head"><h2>${esc(nm(cat.name))}</h2><span class="sub">${esc(nm(cat.groupName))}</span></div>`;
        for (const { kind, items } of ordered) {
          const gasOrder = { CO2: 0, CO2e: 0, CH4: 1, N2O: 2 };
          if (kind === 'yearly') items.sort((a, b) => b.year - a.year);
          else if (kind === 'gas') items.sort((a, b) => (gasOrder[a.gas] ?? 9) - (gasOrder[b.gas] ?? 9) || a.unit.localeCompare(b.unit));
          const f0 = items[0];
          const names = items.map((x) => nm(x.name));
          const suffix = kind === 'names' && items.length > 1 ? commonSuffix(names) : '';
          const title =
            kind === 'yearly' ? stripYear(nm(f0.name), f0.year)
            : kind === 'gas' ? stripGas(nm(f0.name))
            : kind === 'names' ? suffix.replace(/^[\s·,，、]+/, '') || nm(f0.name)
            : nm(f0.name);
          const max = Math.max(...items.map((x) => Math.abs(x.value)));
          const regions = [...new Set(items.map((x) => x.region))].map((r) => `<span class="chip">${esc(pick(REGION, r))}</span>`).join('');
          const scope = f0.scope ? `<span class="chip">${esc(L(`範圍 ${f0.scope}`, `Scope ${f0.scope}`))}</span>` : '';
          out += `<div class="series"><div class="series-head"><h3>${esc(title)}</h3><div class="meta">${regions}${scope}${qTag(f0.quality)}</div></div>`;
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
            out += `<button type="button" class="row" data-id="${esc(f.id)}">
              <span class="yr">${esc(yearFmt(f))}</span>
              <span class="label">${label}</span>
              <span class="val">${esc(groupDigits(f.value_text))}<span class="u">${esc(unitFmt(f.unit))}</span></span>
              <span class="st">${statusTag(f.status)}</span>
            </button>`;
          }
          out += '</div>';
        }
        out += '</section>';
      }
      groupsEl.innerHTML = out;
    }

    catList.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]');
      if (!b) return;
      state.cat = b.dataset.cat;
      render();
    });
    $('#status-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-status]');
      if (!b) return;
      state.status = b.dataset.status;
      for (const x of $('#status-seg').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      render();
    });
    let timer;
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = q.value.trim(); render(); }, 120); });
    $('[data-filters-toggle]').addEventListener('click', () => $('#filters').classList.toggle('open'));
    groupsEl.addEventListener('click', (e) => {
      const row = e.target.closest('.row');
      if (row) location.hash = `f=${encodeURIComponent(row.dataset.id)}`;
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

    function close() {
      if (!drawer.classList.contains('open')) return;
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      scrim.hidden = true;
      document.body.style.overflow = '';
      if (location.hash.startsWith('#f=')) history.replaceState(null, '', location.pathname + location.search);
      lastFocus?.focus?.();
    }

    function open(id) {
      const f = DATA.factors.find((x) => x.id === id);
      if (!f) return close();
      lastFocus = document.activeElement;
      body.innerHTML = detail(f);
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      scrim.hidden = false;
      document.body.style.overflow = 'hidden';
      drawer.scrollTop = 0;
      $('.d-close', body).focus();
    }

    const fromHash = () => {
      const m = location.hash.match(/^#f=(.+)$/);
      if (m) open(decodeURIComponent(m[1])); else close();
    };
    window.addEventListener('hashchange', fromHash);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    body.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]')) close();
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

    return `
      <div class="d-top">
        <span class="d-crumb">${esc(nm(cat?.groupName))} / ${esc(nm(cat?.name))}</span>
        <button class="d-close" type="button" data-close aria-label="${esc(L('關閉', 'Close'))}">×</button>
      </div>
      <h2 id="d-title">${esc(nm(f.name))}</h2>
      <div class="d-value">
        <span class="num">${esc(groupDigits(f.value_text))}</span>
        <span class="unit">${esc(unitFmt(f.unit))}</span>
        ${f.unit_definition ? `<span class="unitdef">${esc(nm(f.unit_definition))}</span>` : ''}
      </div>
      <div class="d-tags">${statusTag(f.status)} ${qTag(f.quality)} <span class="chip">${esc(pick(REGION, f.region))}</span>
        ${f.tags?.includes('historical') ? `<span class="chip">${esc(L('歷史數據', 'Historical'))}</span>` : ''}
        ${f.update_frequency === 'irregular' ? `<span class="chip">${esc(L('指引常數', 'Guideline constant'))}</span>` : ''}</div>
      ${f.notes ? `<p class="d-notes">${esc(nm(f.notes))}</p>` : ''}
      ${f.derivation ? `<div class="d-section"><h3>${esc(L('算式', 'Derivation'))}</h3><div class="derivation">${esc(f.derivation)}</div></div>` : ''}
      <div class="d-section">
        <h3>${esc(L('出處', 'Source'))}</h3>
        <div class="source-card">
          <div class="title">${esc(lang() === 'en' ? src.title : src.title_zh || src.title)}</div>
          <div class="pub">${esc(src.publisher)}${src.edition ? ` · ${esc(src.edition)}` : ''}</div>
          ${loc ? `<div class="loc">${esc(loc)}</div>` : ''}
          <div class="links">
            ${src.url ? `<a class="btn" href="${esc(src.url)}" target="_blank" rel="noopener">${esc(L('原文', 'Original'))} ↗</a>` : ''}
            ${src.archive_url ? `<a class="btn" href="${esc(src.archive_url)}" target="_blank" rel="noopener">${esc(L('存檔', 'Archive'))} ↗</a>` : ''}
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
          <button class="btn primary" type="button" data-copy="${esc(citation)}">${esc(L('複製引用', 'Copy citation'))}</button>
          <a class="btn" href="${esc(fileUrl)}" target="_blank" rel="noopener">${esc(L('原始資料檔', 'Data file'))} ↗</a>
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
            ${s.url ? `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(L('原文', 'Original'))} ↗</a>` : ''}
            ${s.archive_url ? `<a class="btn" href="${esc(s.archive_url)}" target="_blank" rel="noopener">${esc(L('存檔', 'Archive'))} ↗</a>` : ''}
          </div></td>
        </tr>`).join('') || `<tr><td colspan="4" class="muted">${esc(L('沒有符合條件的來源。', 'No matching sources.'))}</td></tr>`;
    }
    sq.addEventListener('input', render);
    usedOnly.addEventListener('change', render);
    rerender.push(render);
    render();
  }
})();
