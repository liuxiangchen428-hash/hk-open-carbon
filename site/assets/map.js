/* HK Open Carbon Platform — district carbon map (map.html). No dependencies.
   Layers: supply area and emission factor; HK Electric consumption by district; CLP customer solar by region.
   Every number shown is copied from data/map/*.csv or the factor library; nothing is estimated here. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const html = document.documentElement;
  const lang = () => (html.dataset.lang === 'en' ? 'en' : 'zh');
  const L = (zh, en) => (lang() === 'en' ? en : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const v = document.body.dataset.v || '';

  const svg = $('#map-svg');
  if (!svg) return;
  const KOWLOON = ['E', 'F', 'G', 'H', 'J'];
  const NT = ['K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S'];
  const st = { layer: 'supply', sel: null, hover: null, hkePeriod: null, solarMonth: null, factorYear: null };
  let M, F, byCode, full, view;

  Promise.all([fetch(`assets/map.json?v=${v}`).then((r) => r.json()), fetch(`assets/data.json?v=${v}`).then((r) => r.json())]).then(([m, d]) => {
    M = m;
    byCode = new Map(M.districts.map((x) => [x.code, x]));
    // Yearly supplier factors from the library (reviewed only; excludes the superseded guideline value).
    F = {};
    for (const f of d.factors) {
      const mm = f.id.match(/^hk\.energy\.electricity\.(clp|hke)\.(\d{4})$/);
      if (mm && f.status === 'reviewed') (F[mm[1]] ||= []).push({ year: +mm[2], value: f.value, text: f.value_text, id: f.id });
    }
    for (const k in F) F[k].sort((a, b) => a.year - b.year);
    const periods = [...new Set(M.hke.map((r) => `${r.year}-${r.half}`))].sort();
    st.hkePeriod = periods.at(-1);
    st.solarMonth = [...new Set(M.clpRe.map((r) => r.month))].sort().at(-1);
    full = [...M.viewBox];
    view = [...full];
    // Link state: #layer=hke&d=B&p=2025-H2&m=2026-09
    const hp = new URLSearchParams(location.hash.slice(1));
    if (['supply', 'hke', 'solar'].includes(hp.get('layer'))) st.layer = hp.get('layer');
    if (periods.includes(hp.get('p'))) st.hkePeriod = hp.get('p');
    if (M.clpRe.some((r) => r.month === hp.get('m'))) st.solarMonth = hp.get('m');
    draw();
    bind();
    render();
    if (byCode.has(hp.get('d'))) select(hp.get('d'));
    new MutationObserver(render).observe(html, { attributes: true, attributeFilter: ['data-lang'] });
    new ResizeObserver(() => render()).observe(svg);
  });

  /* ---------- helpers on the data ---------- */
  const supplierOf = (code) => (M.supply['HK-HKE'].includes(code) ? 'hke' : 'clp');
  const SUP = { clp: ['中電', 'CLP'], hke: ['港燈', 'HK Electric'] };
  const regionOf = (code) => (KOWLOON.includes(code) ? 'kowloon' : NT.includes(code) ? 'nt' : null);
  const REGION = { kowloon: ['九龍', 'Kowloon'], nt: ['新界', 'New Territories'] };
  const latestFactor = (sup) => F[sup]?.at(-1);
  const hkeRow = (code, period) => M.hke.find((r) => `${r.year}-${r.half}` === period && r.district === code);
  const solarRow = (region, month) => M.clpRe.find((r) => r.month === month && r.region === region);
  const periodName = (p) => { const [y, h] = p.split('-'); return L(`${y} 年${h === 'H1' ? '上半年' : '下半年'}`, `${h === 'H1' ? 'Jan–Jun' : 'Jul–Dec'} ${y}`); };
  const monthName = (m) => { const [y, mo] = m.split('-'); return L(`${y} 年 ${+mo} 月`, new Date(+y, +mo - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' })); };
  const name = (d) => L(d.zh, `${d.en}`);

  /* ---------- drawing ---------- */
  function draw() {
    svg.setAttribute('viewBox', view.join(' '));
    svg.innerHTML = `<g id="map-g">${M.districts.map((d) => `<path class="dist" data-code="${d.code}" d="${d.d}" tabindex="0" role="button" aria-label="${esc(d.zh)} ${esc(d.en)}"></path>`).join('')}</g>
      <g id="map-labels" aria-hidden="true">${M.districts.map((d) => `<text class="dl" data-code="${d.code}" x="${d.label[0]}" y="${d.label[1]}"></text>`).join('')}</g>`;
  }

  // t in 0..1 -> colour on the layer's ramp (two ends defined in CSS), mixed in OKLab.
  const ramp = (name, t) => `color-mix(in oklab, var(--${name}-hi) ${Math.round(Math.max(0, Math.min(1, t)) * 100)}%, var(--${name}-lo))`;
  function fillFor(code) {
    if (st.layer === 'supply') {
      // Colour by the latest emission factor per kWh: lighter = cleaner.
      const c = latestFactor('clp').value, h = latestFactor('hke').value;
      const v = supplierOf(code) === 'hke' ? h : c;
      return ramp('ember', 0.12 + 0.88 * (v - 0.3) / (Math.max(c, h) - 0.3));
    }
    if (st.layer === 'hke') {
      if (supplierOf(code) !== 'hke') return 'var(--map-off)';
      const rows = M.districts.filter((d) => supplierOf(d.code) === 'hke').map((d) => hkeRow(d.code, st.hkePeriod)?.consumption_gwh ?? 0);
      const r = hkeRow(code, st.hkePeriod);
      if (!r) return 'var(--map-off)';
      const t = (r.consumption_gwh - Math.min(...rows)) / ((Math.max(...rows) - Math.min(...rows)) || 1);
      return ramp('ember', 0.15 + t * 0.85);
    }
    const reg = regionOf(code);
    if (!reg) return 'var(--map-off)';
    const vals = ['kowloon', 'nt'].map((g) => solarRow(g, st.solarMonth)?.solar_wind_kwh ?? 0);
    const r = solarRow(reg, st.solarMonth);
    const t = r ? r.solar_wind_kwh / (Math.max(...vals) || 1) : 0;
    return ramp('sun', 0.2 + t * 0.8);
  }

  function labelFor(d) {
    if (st.layer === 'supply') return d.zh.replace('區', '');
    if (st.layer === 'hke') { const r = hkeRow(d.code, st.hkePeriod); return r ? `${d.zh.replace('區', '')} ${num(r.consumption_gwh)}` : ''; }
    return '';
  }

  const syncHash = () => {
    const p = new URLSearchParams({ layer: st.layer });
    if (st.sel) p.set('d', st.sel);
    if (st.layer === 'hke') p.set('p', st.hkePeriod);
    if (st.layer === 'solar') p.set('m', st.solarMonth);
    history.replaceState(null, '', `#${p}`);
  };
  function render() {
    syncHash();
    // layer buttons and period selector
    $$('#map-layer button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === st.layer)));
    const wrap = $('#map-period-wrap'), sel = $('#map-period');
    if (st.layer === 'supply') wrap.hidden = true;
    else {
      wrap.hidden = false;
      if (st.layer === 'hke') {
        const ps = [...new Set(M.hke.map((r) => `${r.year}-${r.half}`))].sort().reverse();
        $('#map-period-label').textContent = L('時期', 'Period');
        sel.innerHTML = ps.map((p) => `<option value="${p}"${p === st.hkePeriod ? ' selected' : ''}>${esc(periodName(p))}</option>`).join('');
      } else {
        const ms = [...new Set(M.clpRe.map((r) => r.month))].sort().reverse();
        $('#map-period-label').textContent = L('月份', 'Month');
        sel.innerHTML = ms.map((m) => `<option value="${m}"${m === st.solarMonth ? ' selected' : ''}>${esc(monthName(m))}</option>`).join('');
      }
    }
    for (const p of $$('.dist', svg)) {
      p.style.fill = fillFor(p.dataset.code);
      p.classList.toggle('sel', p.dataset.code === st.sel);
      p.classList.toggle('dim', !!st.sel && p.dataset.code !== st.sel);
    }
    for (const tx of $$('.dl', svg)) {
      const d = byCode.get(tx.dataset.code);
      tx.textContent = lang() === 'en' ? '' : labelFor(d);
      tx.classList.toggle('hide', !!st.sel && tx.dataset.code !== st.sel);
    }
    sizes();
    renderLegend();
    renderPanel();
    renderNotes();
  }

  // Keep strokes and labels the same size on screen at any zoom: convert screen pixels to map units.
  function sizes() {
    const upp = view[2] / (svg.getBoundingClientRect().width || full[2]);
    for (const tx of $$('.dl', svg)) {
      tx.style.fontSize = `${(st.sel === tx.dataset.code ? 15 : 11) * upp}px`;
      tx.style.strokeWidth = `${3 * upp}px`;
    }
    for (const p of $$('.dist', svg)) p.style.strokeWidth = `${(p.classList.contains('sel') ? 2.5 : 0.8) * upp}px`;
  }

  function renderLegend() {
    const el = $('#map-legend');
    if (st.layer === 'supply') {
      el.innerHTML = `<span><i style="background:${fillFor('E')}"></i>${esc(L(`中電 ${latestFactor('clp').text}`, `CLP ${latestFactor('clp').text}`))}</span><span><i style="background:${fillFor('A')}"></i>${esc(L(`港燈 ${latestFactor('hke').text}`, `HK Electric ${latestFactor('hke').text}`))}</span><span class="muted">${esc(L('kg CO₂e / 度，顏色越深排放越高', 'kg CO₂e per kWh; darker = higher'))}</span>`;
    } else if (st.layer === 'hke') {
      el.innerHTML = `<span><i class="ramp ember"></i>${esc(L('用電量，越深越多', 'Consumption, darker = more'))}</span><span><i style="background:var(--map-off)"></i>${esc(L('中電區沒有分區數據', 'No district data (CLP area)'))}</span>`;
    } else {
      el.innerHTML = `<span><i class="ramp sun"></i>${esc(L('太陽能及風能發電，越深越多（只分九龍、新界）', 'Solar and wind, darker = more (Kowloon / NT only)'))}</span><span><i style="background:var(--map-off)"></i>${esc(L('沒有數據', 'No data'))}</span>`;
    }
  }

  /* ---------- tooltip ---------- */
  function tipHtml(code) {
    const d = byCode.get(code), sup = supplierOf(code), f = latestFactor(sup);
    const head = `<b>${esc(d.zh)}</b><small>${esc(d.en)}</small>`;
    if (st.layer === 'supply') return `${head}<p>${esc(L(`${SUP[sup][0]}供電`, `${SUP[sup][1]} supply area`))}${code === 'T' ? esc(L('（南丫島由港燈供電）', ' (Lamma: HK Electric)')) : ''}</p><p class="big">${esc(f.text)} <span>kg CO₂e / ${esc(L('度', 'kWh'))} · ${f.year}</span></p>`;
    if (st.layer === 'hke') {
      const r = hkeRow(code, st.hkePeriod);
      if (!r) return `${head}<p>${esc(L('中電沒有公佈分區用電量', 'CLP does not publish consumption by district'))}</p>`;
      return `${head}<p class="big">${esc(num(r.consumption_gwh))} <span>${esc(L('百萬度', 'GWh'))} · ${esc(periodName(st.hkePeriod))}</span></p><p>${esc(L(`${num(r.customers_k)} 千客戶，平均每戶 ${num(r.avg_kwh)} 度`, `${num(r.customers_k)}k customers, ${num(r.avg_kwh)} kWh each on average`))}</p>`;
    }
    const reg = regionOf(code);
    if (!reg) return `${head}<p>${esc(code === 'T' ? L('中電沒有註明離島屬於哪一區', 'CLP does not say which region the islands belong to') : L('港燈區，沒有這項數據', 'HK Electric area, no data'))}</p>`;
    const r = solarRow(reg, st.solarMonth);
    return `${head}<p>${esc(L(`以下是整個${REGION[reg][0]}的數字`, `Figures for all of ${REGION[reg][1]}`))}</p><p class="big">${esc(num(r.solar_wind_kwh / 1e6, 2))} <span>${esc(L('百萬度', 'GWh'))} · ${esc(monthName(st.solarMonth))}</span></p><p>${esc(L(`${num(r.solar_wind_accounts)} 個太陽能及風能客戶`, `${num(r.solar_wind_accounts)} solar and wind accounts`))}</p>`;
  }

  /* ---------- zoom ---------- */
  function zoomTo(target) {
    const from = [...view];
    const [W, H] = [full[2], full[3]];
    const t0 = performance.now(), dur = reduce ? 0 : matchMedia('(max-width: 900px)').matches ? 800 : 650;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = ease(k);
      view = from.map((a, i) => a + (target[i] - a) * e);
      svg.setAttribute('viewBox', view.join(' '));
      sizes();
      if (k < 1) requestAnimationFrame(step); else { view = target; render(); }
    };
    requestAnimationFrame(step);
    void W; void H;
  }
  function boxFor(code) {
    const [x0, y0, x1, y1] = byCode.get(code).bbox;
    const ar = full[2] / full[3];
    let w = (x1 - x0) * 1.5, h = (y1 - y0) * 1.5;
    w = Math.max(w, 160); h = Math.max(h, 160 / ar);
    if (w / h > ar) h = w / ar; else w = h * ar;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function select(code) {
    if (st.sel === code) return;
    st.sel = code;
    st.factorYear = null;
    $('#map-back').hidden = !code;
    zoomTo(code ? boxFor(code) : [...full]);
    render();
    // Phones: keep the whole map on screen so the zoom can be seen; the details wait behind a button.
    const phone = matchMedia('(max-width: 900px)').matches;
    const more = $('#map-more');
    more.hidden = !(code && phone);
    if (code && phone) {
      more.textContent = L(`查看${byCode.get(code).zh}詳情 ↓`, `${byCode.get(code).en} details ↓`);
      const r = $('#map-stage').getBoundingClientRect();
      const top = 70; // below the sticky header
      if (r.top < top || r.bottom > innerHeight - 80) scrollTo({ top: scrollY + r.top - top, behavior: reduce ? 'auto' : 'smooth' });
    }
  }


  /* ---------- shareable data card (PNG): whole map + the numbers behind it ---------- */
  async function saveCard() {
    const cs = getComputedStyle(document.body);
    const font = cs.fontFamily, BG = cs.backgroundColor, INK = cs.color;
    const tmp = document.createElement('canvas').getContext('2d');
    const rgb = (css) => { const el = document.createElement('i'); el.style.color = css; document.body.append(el); const c = getComputedStyle(el).color; el.remove(); tmp.clearRect(0, 0, 1, 1); tmp.fillStyle = c; tmp.fillRect(0, 0, 1, 1); const [r, g, b, a] = tmp.getImageData(0, 0, 1, 1).data; return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`; };
    const MUTED = rgb(`color-mix(in srgb, ${INK} 60%, transparent)`), LINE = rgb(`color-mix(in srgb, ${INK} 14%, transparent)`);
    const ACC = st.layer === 'solar' ? rgb('var(--sun-hi)') : rgb('var(--ember-hi)');
    const mapLine = rgb(getComputedStyle(svg.querySelector('.dist')).stroke);

    // 1. The whole map, drawn fresh (not the zoomed view) so the district is seen in context.
    const MW = 660, MH = Math.round(MW * full[3] / full[2]), upp = full[2] / MW;
    const paths = M.districts.map((d) => {
      const el = svg.querySelector(`.dist[data-code="${d.code}"]`);
      const on = st.sel === d.code, dim = st.sel && !on;
      return `<path d="${d.d}" fill="${rgb(getComputedStyle(el).fill)}" fill-opacity="${dim ? 0.4 : 1}" stroke="${on ? INK : mapLine}" stroke-width="${(on ? 3 : 0.8) * upp}" stroke-linejoin="round"/>`;
    });
    const sel = st.sel && M.districts.find((d) => d.code === st.sel);
    const labels = lang() === 'en' ? [] : M.districts.filter((d) => (st.sel ? d.code === st.sel : st.layer !== 'hke' || supplierOf(d.code) === 'hke')).map((d) => {
      const t = d.zh.replace('區', '');
      const fs = (d.code === st.sel ? 15 : 11) * upp;
      return `<text x="${d.label[0]}" y="${d.label[1]}" text-anchor="middle" dominant-baseline="middle" font-family="${esc(font)}" font-weight="700" font-size="${fs}" fill="${INK}" stroke="${BG}" stroke-width="${3 * upp}" paint-order="stroke">${esc(t)}</text>`;
    });
    // Draw the selected outline last so its border is not covered.
    if (sel) { const i = M.districts.indexOf(sel); paths.push(paths.splice(i, 1)[0]); }
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}" viewBox="${full.join(' ')}">${paths.join('')}${labels.join('')}</svg>`;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    await img.decode();

    // 2. Layout: header, map left, facts right, footer.
    const PAD = 40, GAP = 40, RW = 440, W = PAD * 2 + MW + GAP + RW, HEAD = 104, scale = 2;
    const blocks = cardBlocks();
    // Measure the right column first.
    const measure = () => blocks.reduce((h, b) => h + b.h, 0);
    const bodyH = Math.max(MH + 60, measure());
    const H = HEAD + bodyH + 86;
    const cv = Object.assign(document.createElement('canvas'), { width: W * scale, height: H * scale });
    const c = cv.getContext('2d'); c.scale(scale, scale);
    c.fillStyle = BG; c.fillRect(0, 0, W, H);
    const text = (t, x, y, size, { w = 400, col = INK, align = 'left' } = {}) => { c.font = `${w} ${size}px ${font}`; c.fillStyle = col; c.textAlign = align; c.fillText(t, x, y); c.textAlign = 'left'; return c.measureText(t).width; };
    // header
    c.fillStyle = INK; c.fillRect(PAD, 24, 36, 5);
    text(L('香港碳地圖', 'Hong Kong carbon map'), PAD, 64, 28, { w: 800 });
    text(cardSubtitle(), PAD, 90, 15, { col: MUTED });
    // map + legend
    c.drawImage(img, PAD, HEAD, MW, MH);
    let lx = PAD; const ly = HEAD + MH + 28;
    for (const it of legendItems()) {
      if (it.ramp) { const g = c.createLinearGradient(lx, 0, lx + 54, 0); g.addColorStop(0, rgb(`var(--${it.ramp}-lo)`)); g.addColorStop(1, rgb(`var(--${it.ramp}-hi)`)); c.fillStyle = g; c.fillRect(lx, ly - 11, 54, 12); lx += 62; }
      else { c.fillStyle = rgb(it.color); c.fillRect(lx, ly - 11, 14, 12); lx += 20; }
      lx += text(it.label, lx, ly, 13, { col: MUTED }) + 18;
    }
    // right column
    const X = PAD + MW + GAP;
    let y = HEAD + 4;
    for (const b of blocks) { b.draw(c, X, y, RW, { text, INK, MUTED, LINE, ACC, rgb }); y += b.h; }
    // footer
    c.fillStyle = LINE; c.fillRect(PAD, H - 70, W - PAD * 2, 1);
    text(cardSource(), PAD, H - 44, 13, { col: MUTED });
    text(L('香港開源碳核算平台 · liuxiangchen428-hash.github.io/hk-open-carbon · 數據 CC BY 4.0', 'HK Open Carbon Platform · liuxiangchen428-hash.github.io/hk-open-carbon · data CC BY 4.0'), PAD, H - 22, 13, { col: MUTED });
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.setAttribute('download', `hk-carbon-map-${st.layer}${st.sel ? `-${st.sel}` : ''}.png`);
    document.body.append(a); a.click(); a.remove();
  }

  function cardSubtitle() {
    const layer = { supply: L('供電公司及每度電排放', 'Supplier and emissions per kWh'), hke: `${L('港燈分區用電', 'HK Electric consumption by district')} · ${periodName(st.hkePeriod)}`, solar: `${L('中電客戶自家太陽能及風能', 'CLP customer solar and wind')} · ${monthName(st.solarMonth)}` }[st.layer];
    return st.sel ? `${L(byCode.get(st.sel).zh, byCode.get(st.sel).en)} · ${layer}` : layer;
  }
  function cardSource() {
    const parts = [L('地界：政府統計處 2021 年人口普查', 'Boundaries: C&SD 2021 Census')];
    parts.push(L('每度電排放：中電、港燈可持續發展報告', 'Per kWh: CLP and HK Electric sustainability reports'));
    if (st.layer === 'hke' || ['A', 'B', 'C', 'D'].includes(st.sel)) parts.push(L('分區用電：港燈開放數據', 'District use: HK Electric open data'));
    if (st.layer === 'solar' || (st.sel && regionOf(st.sel))) parts.push(L('太陽能：中電開放數據', 'Solar: CLP open data'));
    return `${parts.join(L('；', '; '))}${L('。照錄原文，不作推算。', '. Copied as published, nothing estimated.')}`;
  }
  function legendItems() {
    if (st.layer === 'supply') return [{ color: fillFor('E'), label: L(`中電 ${latestFactor('clp').text}`, `CLP ${latestFactor('clp').text}`) }, { color: fillFor('A'), label: L(`港燈 ${latestFactor('hke').text} kg CO₂e/度`, `HK Electric ${latestFactor('hke').text} kg CO₂e/kWh`) }];
    if (st.layer === 'hke') return [{ ramp: 'ember', label: L('用電量，越深越多', 'Consumption, darker = more') }, { color: 'var(--map-off)', label: L('中電區沒有分區數據', 'No district data (CLP)') }];
    return [{ ramp: 'sun', label: L('發電量，越深越多', 'Generation, darker = more') }, { color: 'var(--map-off)', label: L('沒有數據', 'No data') }];
  }

  // Right-column blocks: each has a height and a draw function.
  function cardBlocks() {
    const out = [];
    const kicker = (k, h = 28) => ({ h, draw: (c, x, y, w, u) => { u.text(k, x, y + 14, 13, { w: 700, col: u.MUTED }); } });
    const title = (t, sub) => ({ h: sub ? 78 : 52, draw: (c, x, y, w, u) => { u.text(t, x, y + 30, 30, { w: 800 }); if (sub) u.text(sub, x, y + 58, 14, { col: u.MUTED }); } });
    const big = (head, value, unit, note) => ({ h: note ? 112 : 92, draw: (c, x, y, w, u) => {
      c.fillStyle = u.INK; c.fillRect(x, y, w, 2);
      u.text(head, x, y + 26, 14, { w: 700 });
      const vw = u.text(value, x, y + 72, 40, { w: 800 });
      u.text(unit, x + vw + 10, y + 72, 14, { col: u.MUTED });
      if (note) u.text(note, x, y + 98, 13, { col: u.MUTED });
    } });
    const barsB = (items, shared) => ({ h: 112, draw: (c, x, y, w, u) => {
      const max = shared || Math.max(...items.map((i) => i.v)) || 1, n = items.length, bw = w / n, ch = 62, top = y + 18;
      const every = Math.ceil(n / 12);
      items.forEach((it, i) => {
        const h = Math.max(2, (it.v / max) * ch), bx = x + i * bw + bw * 0.18;
        c.fillStyle = it.on ? u.ACC : u.LINE; c.fillRect(bx, top + ch - h, bw * 0.64, h);
        if (it.on) u.text(it.text, bx + bw * 0.32, top + ch - h - 6, 12, { w: 700, align: 'center' });
        if (i % every === 0 || it.on) u.text(it.short, bx + bw * 0.32, top + ch + 18, 11, { col: it.on ? u.INK : u.MUTED, w: it.on ? 700 : 400, align: 'center' });
      });
    } });
    const rows = (items, unit) => ({ h: 26 + items.length * 34, draw: (c, x, y, w, u) => {
      c.fillStyle = u.INK; c.fillRect(x, y, w, 2);
      const max = Math.max(...items.map((i) => i.v)) || 1;
      items.forEach((it, i) => {
        const ry = y + 30 + i * 34;
        u.text(it.label, x, ry + 4, 14, { w: it.on ? 800 : 500 });
        u.text(it.text, x + w, ry + 4, 14, { w: 700, align: 'right' });
        c.fillStyle = it.color ? u.rgb(it.color) : it.on ? u.ACC : u.LINE; c.fillRect(x, ry + 11, Math.max(2, (it.v / max) * w), 6);
      });
      if (unit) u.text(unit, x, y + 30 + items.length * 34 - 2, 12, { col: u.MUTED });
    } });
    const gap = (h) => ({ h, draw: () => {} });
    const yrBars = (series, cur, shared) => barsB(series.slice(-12).map((f) => ({ v: f.value, text: f.text, short: `'${String(f.year).slice(2)}`, on: f.year === cur })), shared);
    const kwh = L('kg CO₂e / 度', 'kg CO₂e / kWh');

    if (!st.sel) {
      out.push(kicker(st.layer === 'hke' ? L('港島及南丫島', 'HK Island and Lamma') : st.layer === 'solar' ? L('中電供電區', 'CLP supply area') : L('全港', 'All of Hong Kong')));
      if (st.layer === 'supply') {
        const cf = latestFactor('clp'), hf = latestFactor('hke');
        const top = Math.max(...[...F.clp, ...F.hke].slice(-24).map((f) => f.value));
        out.push(big(L('中電 · 九龍、新界、大部分離島', 'CLP · Kowloon, NT, most islands'), cf.text, `${kwh} · ${cf.year}`), yrBars(F.clp, cf.year, top), gap(8));
        out.push(big(L('港燈 · 港島、鴨脷洲、南丫島', 'HK Electric · HK Island, Ap Lei Chau, Lamma'), hf.text, `${kwh} · ${hf.year}`), yrBars(F.hke, hf.year, top));
      } else if (st.layer === 'hke') {
        const rs = ['A', 'B', 'C', 'D', 'T-lamma'].map((c) => ({ c, r: hkeRow(c, st.hkePeriod) })).filter((x) => x.r).sort((a, b) => b.r.consumption_gwh - a.r.consumption_gwh);
        const tot = rs.reduce((t, x) => t + x.r.consumption_gwh, 0);
        out.push(title(L('港島各區用電', 'Consumption by district'), periodName(st.hkePeriod)));
        out.push(rows(rs.map(({ c, r }) => ({ color: c === 'T-lamma' ? ramp('ember', 0.15) : fillFor(c), label: c === 'T-lamma' ? L('南丫島', 'Lamma') : L(byCode.get(c).zh, byCode.get(c).en), v: r.consumption_gwh, text: num(r.consumption_gwh) })), L(`百萬度（GWh）· 五項合計 ${num(tot)}`, `GWh · five areas together ${num(tot)}`)));
        out.push(gap(16), kicker(L('中電沒有公佈分區用電，九龍、新界不能按區比較。', 'CLP does not publish district consumption.'), 24));
      } else {
        const k = solarRow('kowloon', st.solarMonth), n = solarRow('nt', st.solarMonth);
        out.push(big(L('新界', 'New Territories'), num(n.solar_wind_kwh / 1e6, 2), `${L('百萬度', 'GWh')} · ${monthName(st.solarMonth)}`, L(`${num(n.solar_wind_accounts)} 個太陽能及風能客戶`, `${num(n.solar_wind_accounts)} accounts`)));
        out.push(solarBars('nt'), gap(8));
        out.push(big(L('九龍', 'Kowloon'), num(k.solar_wind_kwh / 1e6, 2), `${L('百萬度', 'GWh')} · ${monthName(st.solarMonth)}`, L(`${num(k.solar_wind_accounts)} 個太陽能及風能客戶`, `${num(k.solar_wind_accounts)} accounts`)));
        out.push(solarBars('kowloon'));
      }
      return out;
    }
    const d = byCode.get(st.sel), sup = supplierOf(st.sel), series = F[sup] || [];
    const fy = series.find((x) => x.year === st.factorYear) || series.at(-1);
    out.push(kicker(L('地區', 'District')));
    out.push(title(L(d.zh, d.en), L(`${d.en} · 人口 ${num(d.population)} · 住戶 ${num(d.households)}（2021 年普查）`, `Population ${num(d.population)} · households ${num(d.households)} (2021 Census)`)));
    out.push(gap(6), big(L(`${SUP[sup][0]}供電 · 每度電排放`, `${SUP[sup][1]} · emissions per kWh`), fy.text, `${kwh} · ${fy.year}`), yrBars(series, fy.year));
    const hkeCode = sup === 'hke' ? st.sel : st.sel === 'T' ? 'T-lamma' : null;
    if (hkeCode) {
      const rs = M.hke.filter((r) => r.district === hkeCode).sort((a, b) => `${a.year}${a.half}`.localeCompare(`${b.year}${b.half}`));
      const r = rs.find((x) => `${x.year}-${x.half}` === st.hkePeriod) || rs.at(-1);
      const p = `${r.year}-${r.half}`;
      const split = [['residential_gwh', L('住宅', 'Res.')], ['commercial_gwh', L('商業', 'Comm.')], ['industrial_gwh', L('工業', 'Ind.')]].map(([k, n]) => `${n} ${Math.round((r[k] / r.total_by_type_gwh) * 100)}%`).join(' · ');
      out.push(gap(10), big(L(hkeCode === 'T-lamma' ? '南丫島用電（港燈）' : '用電量（港燈）', 'Consumption (HK Electric)'), num(r.consumption_gwh), `${L('百萬度', 'GWh')} · ${periodName(p)}`, `${split} · ${L(`平均每戶 ${num(r.avg_kwh)} 度`, `${num(r.avg_kwh)} kWh per customer`)}`));
      out.push(barsB(rs.map((x) => ({ v: x.consumption_gwh, text: num(x.consumption_gwh), short: `${String(x.year).slice(2)}${x.half === 'H1' ? L('上', 'a') : L('下', 'b')}`, on: `${x.year}-${x.half}` === p }))));
    }
    const reg = regionOf(st.sel);
    if (reg) {
      const r = solarRow(reg, st.solarMonth);
      out.push(gap(10), big(L(`自家太陽能及風能 · 整個${REGION[reg][0]}`, `Customer solar and wind · all of ${REGION[reg][1]}`), num(r.solar_wind_kwh / 1e6, 2), `${L('百萬度', 'GWh')} · ${monthName(r.month)}`, L(`${num(r.solar_wind_accounts)} 個客戶；中電只分九龍、新界公佈`, `${num(r.solar_wind_accounts)} accounts; CLP publishes Kowloon / NT only`)));
      out.push(solarBars(reg));
    }
    return out;

    function solarBars(region) {
      const all = M.clpRe.filter((r) => r.region === region).sort((a, b) => a.month.localeCompare(b.month));
      const cur = (all.find((x) => x.month === st.solarMonth) || all.at(-1)).month;
      const yr = all.filter((x) => x.month.slice(0, 4) === cur.slice(0, 4));
      return barsB(yr.map((x) => ({ v: x.solar_wind_kwh, text: num(x.solar_wind_kwh / 1e6, 1), short: String(+x.month.slice(5)), on: x.month === cur })));
    }
  }

  /* ---------- side panel ---------- */
  function bars(items, cur, attr) {
    const max = Math.max(...items.map((x) => x.v)) || 1;
    return `<div class="mbars">${items.map((x) => `<button type="button" class="mb${x.k === cur ? ' on' : ''}" ${attr}="${esc(x.k)}" title="${esc(x.label)}: ${esc(x.text)}">
      <span class="mb-v">${esc(x.text)}</span><span class="mb-b"><span style="height:${Math.max(3, (x.v / max) * 100).toFixed(1)}%"></span></span><span class="mb-x">${esc(x.short)}</span></button>`).join('')}</div>`;
  }

  function renderPanel() {
    const el = $('#map-panel');
    if (!st.sel) { el.innerHTML = overview(); return; }
    const d = byCode.get(st.sel), sup = supplierOf(st.sel);
    const series = F[sup] || [];
    const fy = series.find((x) => x.year === st.factorYear) || series.at(-1);
    let out = `<p class="mp-k">${esc(L('地區', 'District'))}</p><h2>${esc(d.zh)}</h2><p class="mp-en">${esc(d.en)}</p>
      <dl class="mp-facts"><div><dt>${esc(L('人口', 'Population'))}</dt><dd>${esc(num(d.population))}</dd></div><div><dt>${esc(L('住戶', 'Households'))}</dt><dd>${esc(num(d.households))}</dd></div></dl>
      <p class="mp-src">${esc(L('2021 年人口普查', '2021 Population Census'))}</p>
      <section class="mp-sec"><h3>${esc(L(`${SUP[sup][0]}供電 · 每度電排放`, `${SUP[sup][1]} · emissions per kWh`))}</h3>
        <p class="mp-big">${esc(fy.text)} <span>kg CO₂e / ${esc(L('度', 'kWh'))} · ${fy.year}</span></p>
        ${bars(series.slice(-12).map((x) => ({ k: x.year, v: x.value, text: x.text, short: `'${String(x.year).slice(2)}`, label: String(x.year) })), fy.year, 'data-fy')}
        <p class="mp-src">${esc(L('點柱查看該年。來源：電力公司可持續發展報告（見系數庫）。', 'Click a bar for that year. Source: the power company’s sustainability reports (see the factor library).'))} <a href="index.html#f=${encodeURIComponent(fy.id)}">${esc(L('查看系數', 'Open factor'))} →</a></p>
        ${st.sel === 'T' ? `<p class="mp-src">${esc(L('離島區大部分由中電供電，南丫島由港燈供電。', 'Most of Islands District is supplied by CLP; Lamma by HK Electric.'))}</p>` : ''}
      </section>`;
    // HK Electric district consumption
    const hkeCode = sup === 'hke' ? st.sel : st.sel === 'T' ? 'T-lamma' : null;
    if (hkeCode) {
      const rows = M.hke.filter((r) => r.district === hkeCode).sort((a, b) => `${a.year}${a.half}`.localeCompare(`${b.year}${b.half}`));
      const r = rows.find((x) => `${x.year}-${x.half}` === st.hkePeriod) || rows.at(-1);
      const p = `${r.year}-${r.half}`;
      out += `<section class="mp-sec"><h3>${esc(L(hkeCode === 'T-lamma' ? '南丫島用電（港燈）' : '用電量（港燈）', hkeCode === 'T-lamma' ? 'Lamma consumption (HK Electric)' : 'Consumption (HK Electric)'))}</h3>
        <p class="mp-big">${esc(num(r.consumption_gwh))} <span>${esc(L('百萬度', 'GWh'))} · ${esc(periodName(p))}</span></p>
        ${bars(rows.map((x) => ({ k: `${x.year}-${x.half}`, v: x.consumption_gwh, text: num(x.consumption_gwh), short: `${String(x.year).slice(2)}${x.half === 'H1' ? L('上', 'a') : L('下', 'b')}`, label: periodName(`${x.year}-${x.half}`) })), p, 'data-hp')}
        <div class="mp-split">${[['residential_gwh', ['住宅', 'Residential']], ['commercial_gwh', ['商業', 'Commercial']], ['industrial_gwh', ['工業', 'Industrial']]].map(([k, n]) => `<div><span>${esc(L(...n))}</span><b>${esc(num(r[k]))}</b><i style="width:${((r[k] / r.total_by_type_gwh) * 100).toFixed(1)}%"></i></div>`).join('')}</div>
        <p class="mp-src">${esc(L(`${num(r.customers_k)} 千客戶，平均每戶 ${num(r.avg_kwh)} 度。來源：港燈開放數據（DATA.GOV.HK）。`, `${num(r.customers_k)}k customers, ${num(r.avg_kwh)} kWh each on average. Source: HK Electric open data (DATA.GOV.HK).`))}</p>
      </section>`;
    }
    // CLP customer solar by region
    const reg = regionOf(st.sel);
    if (reg) {
      const rows = M.clpRe.filter((r) => r.region === reg).sort((a, b) => a.month.localeCompare(b.month));
      const r = rows.find((x) => x.month === st.solarMonth) || rows.at(-1);
      const year = r.month.slice(0, 4);
      const yr = rows.filter((x) => x.month.startsWith(year));
      out += `<section class="mp-sec"><h3>${esc(L(`自家太陽能及風能 · 整個${REGION[reg][0]}`, `Customer solar and wind · all of ${REGION[reg][1]}`))}</h3>
        <p class="mp-big">${esc(num(r.solar_wind_kwh / 1e6, 2))} <span>${esc(L('百萬度', 'GWh'))} · ${esc(monthName(r.month))}</span></p>
        <div class="mp-years">${[...new Set(rows.map((x) => x.month.slice(0, 4)))].map((y) => `<button type="button" class="chip${y === year ? ' on' : ''}" data-sy="${y}">${y}</button>`).join('')}</div>
        ${bars(yr.map((x) => ({ k: x.month, v: x.solar_wind_kwh, text: num(x.solar_wind_kwh / 1e6, 1), short: String(+x.month.slice(5)), label: monthName(x.month) })), r.month, 'data-sm')}
        <p class="mp-src">${esc(L(`${num(r.solar_wind_accounts)} 個太陽能及風能客戶。中電只按九龍、新界公佈，不分十八區；不包括只供自用的系統。來源：中電開放數據。`, `${num(r.solar_wind_accounts)} solar and wind accounts. CLP publishes Kowloon and the New Territories only, not districts, and excludes systems used only by their owners. Source: CLP open data.`))}</p>
      </section>`;
    } else if (st.sel === 'T') {
      out += `<section class="mp-sec"><h3>${esc(L('自家太陽能及風能', 'Customer solar and wind'))}</h3><p class="mp-src">${esc(L('中電的數字只分九龍、新界，沒有註明離島計入哪一區。', 'CLP splits its figures into Kowloon and the New Territories and does not say where the islands are counted.'))}</p></section>`;
    }
    el.innerHTML = out;
  }

  function overview() {
    if (st.layer === 'supply') {
      const c = latestFactor('clp'), h = latestFactor('hke');
      return `<p class="mp-k">${esc(L('全港', 'All of Hong Kong'))}</p><h2>${esc(L('誰供電，每度電排放多少', 'Who supplies power, and its emissions per kWh'))}</h2>
        <div class="mp-two"><div style="--c:${fillFor('E')}"><span>${esc(L('中電', 'CLP'))}</span><b>${esc(c.text)}</b><small>kg CO₂e / ${esc(L('度', 'kWh'))} · ${c.year}</small><em>${esc(L('九龍、新界、大部分離島', 'Kowloon, NT, most islands'))}</em></div>
        <div style="--c:${fillFor('A')}"><span>${esc(L('港燈', 'HK Electric'))}</span><b>${esc(h.text)}</b><small>kg CO₂e / ${esc(L('度', 'kWh'))} · ${h.year}</small><em>${esc(L('港島、鴨脷洲、南丫島', 'HK Island, Ap Lei Chau, Lamma'))}</em></div></div>
        <p class="mp-hint">${esc(L('點地圖上任何一區，放大並查看歷年數字。', 'Click any district to zoom in and see the years.'))}</p>`;
    }
    if (st.layer === 'hke') {
      const rows = ['A', 'B', 'C', 'D', 'T-lamma'].map((c) => ({ c, r: hkeRow(c, st.hkePeriod) })).filter((x) => x.r);
      const max = Math.max(...rows.map((x) => x.r.consumption_gwh));
      return `<p class="mp-k">${esc(periodName(st.hkePeriod))}</p><h2>${esc(L('港島各區用電', 'Consumption by district, HK Island'))}</h2>
        <div class="mp-rank">${rows.sort((a, b) => b.r.consumption_gwh - a.r.consumption_gwh).map(({ c, r }) => `<button type="button" data-go="${c === 'T-lamma' ? 'T' : c}"><span>${esc(c === 'T-lamma' ? L('南丫島', 'Lamma') : L(byCode.get(c).zh, byCode.get(c).en))}</span><b>${esc(num(r.consumption_gwh))}</b><i style="width:${((r.consumption_gwh / max) * 100).toFixed(1)}%"></i></button>`).join('')}</div>
        <p class="mp-src">${esc(L('百萬度（GWh）。只有港燈公佈分區用電；中電沒有。來源：港燈開放數據（DATA.GOV.HK）。', 'GWh. Only HK Electric publishes consumption by district; CLP does not. Source: HK Electric open data (DATA.GOV.HK).'))}</p>`;
    }
    const k = solarRow('kowloon', st.solarMonth), n = solarRow('nt', st.solarMonth);
    return `<p class="mp-k">${esc(monthName(st.solarMonth))}</p><h2>${esc(L('自家太陽能及風能發電', 'Customer solar and wind generation'))}</h2>
      <div class="mp-two"><div style="--c:${fillFor('R')}"><span>${esc(L('新界', 'New Territories'))}</span><b>${esc(num(n.solar_wind_kwh / 1e6, 2))}</b><small>${esc(L('百萬度', 'GWh'))}</small><em>${esc(L(`${num(n.solar_wind_accounts)} 個客戶`, `${num(n.solar_wind_accounts)} accounts`))}</em></div>
      <div style="--c:${fillFor('E')}"><span>${esc(L('九龍', 'Kowloon'))}</span><b>${esc(num(k.solar_wind_kwh / 1e6, 2))}</b><small>${esc(L('百萬度', 'GWh'))}</small><em>${esc(L(`${num(k.solar_wind_accounts)} 個客戶`, `${num(k.solar_wind_accounts)} accounts`))}</em></div></div>
      <p class="mp-src">${esc(L('接上中電電錶的客戶太陽能及風能系統（上網電價計劃）。中電只分九龍、新界公佈。', 'Customer solar and wind systems on CLP meters (feed-in tariff). CLP publishes Kowloon and the New Territories only.'))}</p>`;
  }

  function renderNotes() {
    const draft = M.status !== 'reviewed';
    $('#map-notes').innerHTML = `<p>${draft ? `<span class="status draft">${esc(L('草稿', 'Draft'))}</span> ${esc(L('地圖數據已由 AI 助手從原文讀取，待維護者核對。', 'Map data read from the sources by the AI assistant, awaiting the maintainer’s check.'))} ` : ''}${esc(L('地界：政府統計處 2021 年人口普查區議會分區界線（為顯示簡化）。', 'Boundaries: Census and Statistics Department, 2021 Census District Council districts (simplified for display).'))}
      <a href="sources.html#registry">${esc(L('全部來源', 'All sources'))} →</a></p>
      <p class="map-dl">${esc(L('下載數據：', 'Download data:'))} <a href="api/v1/hke-district-consumption.csv" download>${esc(L('港燈分區用電 CSV', 'HK Electric by district (CSV)'))}</a> · <a href="api/v1/clp-renewables-by-region.csv" download>${esc(L('中電自家太陽能 CSV', 'CLP customer solar (CSV)'))}</a></p>`;
  }

  /* ---------- events ---------- */
  function bind() {
    const tip = $('#map-tip'), stage = $('#map-stage');
    const showTip = (code, x, y) => {
      tip.innerHTML = tipHtml(code); tip.hidden = false;
      const r = stage.getBoundingClientRect();
      const left = Math.min(r.width - tip.offsetWidth - 8, Math.max(8, x - r.left + 14));
      const top = Math.max(8, y - r.top - tip.offsetHeight - 12);
      tip.style.transform = `translate(${left}px, ${top}px)`;
    };
    const setHover = (code) => {
      if (st.hover === code) return;
      st.hover = code;
      $$('.dist', svg).forEach((p) => p.classList.toggle('hover', p.dataset.code === code));
      if (code) $('#map-g').append(svg.querySelector(`.dist[data-code="${code}"]`)); // bring to front
      const sel = st.sel && svg.querySelector(`.dist[data-code="${st.sel}"]`);
      if (sel && st.sel !== code) $('#map-g').append(sel);
    };
    svg.addEventListener('pointermove', (e) => {
      const p = e.target.closest('.dist');
      if (!p || e.pointerType === 'touch') { setHover(null); tip.hidden = true; return; }
      setHover(p.dataset.code); showTip(p.dataset.code, e.clientX, e.clientY);
    });
    svg.addEventListener('pointerleave', () => { setHover(null); tip.hidden = true; });
    svg.addEventListener('click', (e) => {
      const p = e.target.closest('.dist');
      tip.hidden = true;
      if (p) select(p.dataset.code); else if (st.sel) select(null);
    });
    svg.addEventListener('keydown', (e) => {
      const p = e.target.closest('.dist');
      if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(p.dataset.code); }
    });
    svg.addEventListener('focusin', (e) => { const p = e.target.closest('.dist'); if (p) { const r = p.getBoundingClientRect(); setHover(p.dataset.code); showTip(p.dataset.code, r.left + r.width / 2, r.top + r.height / 2); } });
    svg.addEventListener('focusout', () => { setHover(null); tip.hidden = true; });
    $('#map-back').addEventListener('click', () => select(null));
    $('#map-share').addEventListener('click', (e) => {
      if (e.target.closest('[data-copy-link]')) window.HKOC?.copyLink(e.target.closest('[data-copy-link]'));
      if (e.target.closest('[data-save-chart]')) saveCard();
    });
    $('#map-more').addEventListener('click', () => $('#map-panel').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.sel) select(null); });
    $('#map-layer').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.layer = b.dataset.layer; render(); } });
    $('#map-period').addEventListener('change', (e) => { if (st.layer === 'hke') st.hkePeriod = e.target.value; else st.solarMonth = e.target.value; render(); });
    $('#map-panel').addEventListener('click', (e) => {
      const fy = e.target.closest('[data-fy]'); if (fy) { st.factorYear = +fy.dataset.fy; renderPanel(); return; }
      const hp = e.target.closest('[data-hp]'); if (hp) { st.hkePeriod = hp.dataset.hp; render(); return; }
      const sm = e.target.closest('[data-sm]'); if (sm) { st.solarMonth = sm.dataset.sm; render(); return; }
      const sy = e.target.closest('[data-sy]'); if (sy) { const ms = M.clpRe.map((r) => r.month).filter((m) => m.startsWith(sy.dataset.sy)).sort(); st.solarMonth = ms.at(-1); render(); return; }
      const go = e.target.closest('[data-go]'); if (go) select(go.dataset.go);
    });
  }
})();
