/* HK Open Carbon Platform — business / organisation calculator (business.html). No dependencies.
   Categories follow the EMSD/EPD building GHG guidelines (2010): scope 1 direct, scope 2 purchased
   electricity and town gas, scope 3 optional. Only reviewed factors are used; each line cites its factor. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const html = document.documentElement;
  const lang = () => (html.dataset.lang === 'en' ? 'en' : 'zh');
  const L = (zh, en) => (lang() === 'en' ? en : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => { const x = parseFloat(n); return Number.isFinite(x) && x > 0 ? x : 0; };
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const kgFmt = (kg) => fmt(kg, kg < 10 ? 2 : kg < 100 ? 1 : 0);
  const tFmt = (kg) => fmt(kg / 1000, kg < 10000 ? 3 : 2);
  const form = $('#biz-form');
  if (!form) return;

  // GWPs the 2010 guidelines use to convert CH4 and N2O (IPCC Second Assessment Report).
  const AR2 = { CH4: 21, N2O: 310 };
  const KEY = 'hkoc-biz';
  const VEH = {
    'passenger-car': ['私家車', 'Passenger car'], 'private-van': ['私家貨車', 'Private van'], 'light-goods-vehicle': ['輕型貨車', 'Light goods vehicle'],
    'medium-goods-vehicle': ['中型貨車', 'Medium goods vehicle'], 'heavy-goods-vehicle': ['重型貨車', 'Heavy goods vehicle'], motorcycle: ['電單車', 'Motorcycle'],
    'public-light-bus': ['公共小巴', 'Public light bus'], 'other-mobile-machinery': ['其他流動機械', 'Other mobile machinery'],
  };
  const FUEL = { petrol: ['無鉛汽油', 'Petrol'], diesel: ['柴油', 'Diesel'], lpg: ['石油氣', 'LPG'] };

  let D, byId, srcById;
  const st = load();

  fetch(`assets/data.json?v=${document.body.dataset.v || ''}`).then((r) => r.json()).then((d) => {
    D = d;
    byId = new Map(d.factors.filter((f) => f.status === 'reviewed').map((f) => [f.id, f]));
    srcById = new Map(d.sources.map((s) => [s.id, s]));
    const years = [...new Set(d.factors.filter((f) => /^hk\.energy\.electricity\.(clp|hke)\.\d{4}$/.test(f.id)).map((f) => f.year))].sort((a, b) => b - a);
    if (!st.year || !years.includes(+st.year)) st.year = years[0];
    if (!st.saved[st.year] && hasInput(st)) st.saved[st.year] = snapshot();
    $('#bz-year').innerHTML = years.map((y) => `<option value="${y}"${+st.year === y ? ' selected' : ''}>${y}</option>`).join('');
    fill();
    render();
    new MutationObserver(() => { rows(); render(); }).observe(html, { attributes: true, attributeFilter: ['data-lang'] });
  });

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') return { v: {}, veh: [], ref: [], saved: {}, ...s }; } catch { /* storage blocked */ }
    return { v: {}, veh: [], ref: [], org: '', year: null, saved: {} };
  }
  // The form holds one year's inputs; st.saved keeps every year that has any figure, for the comparison.
  const hasInput = (d) => Object.entries(d.v).some(([k, x]) => k !== 'sewage' && num(x) > 0) || d.veh.some((r) => num(r.litres) > 0) || d.ref.some((r) => ['cs', 'ci', 'cd', 'ce'].some((k) => num(r[k]) > 0));
  const snapshot = () => JSON.parse(JSON.stringify({ v: st.v, veh: st.veh, ref: st.ref }));
  const save = () => {
    if (st.year) { if (hasInput(st)) st.saved[st.year] = snapshot(); else delete st.saved[st.year]; }
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
  };
  function switchYear(y) {
    save();
    st.year = +y;
    const d = st.saved[st.year];
    Object.assign(st, d ? JSON.parse(JSON.stringify(d)) : { v: {}, veh: [], ref: [] });
    $('#bz-year').value = String(st.year);
    fill(); save(); render();
  }

  /* ---------- factors ---------- */
  // Latest reviewed member of a yearly series for the reporting year; else the closest earlier, else the earliest.
  function yearly(prefix, year) {
    const items = [...byId.values()].filter((f) => f.id.startsWith(prefix) && /\.\d{4}$/.test(f.id)).sort((a, b) => a.year - b.year);
    return items.filter((f) => f.year <= year).at(-1) || items[0] || null;
  }
  const vehicleTypes = (fuel) => [...byId.keys()].map((id) => id.match(new RegExp(`^hk\\.energy\\.fuel\\.${fuel}\\.mobile-([a-z-]+)\\.ch4\\.emsd2010$`))?.[1]).filter((t) => t && !t.endsWith('-kg') && VEH[t]);
  const mobileCo2 = (fuel) => byId.get(fuel === 'lpg' ? 'hk.energy.fuel.lpg.mobile-litre.co2.emsd2010' : `hk.energy.fuel.${fuel}.mobile.co2.emsd2010`);
  const refrigerants = () => [...byId.values()].filter((f) => f.id.startsWith('hk.buildings.refrigerant.')).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const refName = (f) => f.name['zh-Hant'].split(' ')[0];

  /* ---------- form ---------- */
  function fill() {
    $('#bz-org').value = st.org || '';
    for (const el of $$('[data-k]', form)) el.value = st.v[el.dataset.k] ?? (el.tagName === 'SELECT' ? el.options[0].value : '');
    rows();
  }
  function rows() {
    $('#bz-veh').innerHTML = st.veh.map((r, i) => {
      const types = vehicleTypes(r.fuel);
      if (!types.includes(r.type)) r.type = types[0];
      return `<div class="biz-row" data-i="${i}" data-g="veh">
        <label class="bf"><span>${esc(L('燃料', 'Fuel'))}</span><select data-f="fuel">${Object.entries(FUEL).map(([k, n]) => `<option value="${k}"${k === r.fuel ? ' selected' : ''}>${esc(L(...n))}</option>`).join('')}</select></label>
        <label class="bf"><span>${esc(L('車輛類別', 'Vehicle type'))}</span><select data-f="type">${types.map((k) => `<option value="${k}"${k === r.type ? ' selected' : ''}>${esc(L(...VEH[k]))}</option>`).join('')}</select></label>
        <label class="bf"><span>${esc(L('全年用量（公升）', 'Litres in the year'))}</span><input data-f="litres" type="number" min="0" step="any" inputmode="decimal" value="${esc(r.litres ?? '')}"></label>
        <button type="button" class="biz-x" data-del aria-label="${esc(L('刪除', 'Remove'))}">×</button></div>`;
    }).join('');
    const refs = refrigerants();
    $('#bz-ref').innerHTML = st.ref.map((r, i) => `<div class="biz-row ref" data-i="${i}" data-g="ref">
        <label class="bf"><span>${esc(L('冷媒', 'Refrigerant'))}</span><select data-f="id">${refs.map((f) => `<option value="${f.id}"${f.id === r.id ? ' selected' : ''}>${esc(refName(f))}</option>`).join('')}</select></label>
        ${[['cs', ['期初存量', 'Stock at start']], ['ci', ['本期購入', 'Purchased']], ['cd', ['環保處置', 'Disposed']], ['ce', ['期末存量', 'Stock at end']]].map(([k, n]) => `<label class="bf"><span>${esc(L(...n))}（kg）</span><input data-f="${k}" type="number" min="0" step="any" inputmode="decimal" value="${esc(r[k] ?? '')}"></label>`).join('')}
        <button type="button" class="biz-x" data-del aria-label="${esc(L('刪除', 'Remove'))}">×</button></div>`).join('');
  }

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'bz-org') st.org = el.value;
    else if (el.dataset.k) st.v[el.dataset.k] = el.value;
    else if (el.dataset.f) {
      const row = el.closest('.biz-row'); const list = st[row.dataset.g]; list[+row.dataset.i][el.dataset.f] = el.value;
      if (el.dataset.f === 'fuel') { rows(); }
    }
    save(); render();
  });
  form.addEventListener('change', (e) => { if (e.target.id === 'bz-year') switchYear(e.target.value); });
  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      if (add.dataset.add === 'veh') st.veh.push({ fuel: 'diesel', type: 'light-goods-vehicle', litres: '' });
      else st.ref.push({ id: 'hk.buildings.refrigerant.r-410a.emsd2010', cs: '', ci: '', cd: '', ce: '' });
      rows(); save(); render(); return;
    }
    const del = e.target.closest('[data-del]');
    if (del) { const row = del.closest('.biz-row'); st[row.dataset.g].splice(+row.dataset.i, 1); rows(); save(); render(); return; }
    if (e.target.closest('[data-example]')) {
      Object.assign(st, { org: L('示例公司', 'Example Ltd'), v: { clp: '120000', hke: '', gas: '3000', 'st-diesel': '200', 'st-lpg': '', 'st-kerosene': '', water: '1500', sewage: '1', 'p-start': '50', 'p-buy': '500', 'p-recycle': '200', 'p-end': '60' },
        veh: [{ fuel: 'diesel', type: 'light-goods-vehicle', litres: '2400' }, { fuel: 'petrol', type: 'passenger-car', litres: '1200' }],
        ref: [{ id: 'hk.buildings.refrigerant.r-410a.emsd2010', cs: '10', ci: '20', cd: '0', ce: '15' }] });
      fill(); save(); render(); return;
    }
    if (e.target.closest('[data-clear]')) { Object.assign(st, { v: {}, veh: [], ref: [] }); fill(); save(); render(); }
  });

  /* ---------- calculation ---------- */
  function lines(d = st) {
    const y = +d.year, v = d.v, out = [];
    const push = (scope, key, name, qty, unit, f, extra = {}) => {
      if (!f || !(qty > 0)) return;
      const mult = extra.gwp ?? 1, toKg = extra.toKg ?? 1;
      out.push({ scope, key, name, qty, unit, f, gwp: extra.gwp, kg: qty * f.value * toKg * mult, warn: extra.warn });
    };
    const yearWarn = (f) => (f && f.year !== y ? L(`沒有 ${y} 年的系數，用 ${f.year} 年`, `No ${y} factor; ${f.year} used`) : '');
    // Scope 2
    const clp = yearly('hk.energy.electricity.clp.', y), hke = yearly('hk.energy.electricity.hke.', y), gasP = yearly('hk.energy.town-gas.purchased.', y);
    push(2, 'clp', ['外購電力（中電）', 'Electricity (CLP)'], num(v.clp), 'kWh', clp, { warn: yearWarn(clp) });
    push(2, 'hke', ['外購電力（港燈）', 'Electricity (HK Electric)'], num(v.hke), 'kWh', hke, { warn: yearWarn(hke) });
    push(2, 'gas-p', ['外購煤氣（生產排放）', 'Town gas (production)'], num(v.gas), L('單位', 'unit'), gasP, { warn: yearWarn(gasP) });
    // Scope 1: town gas burnt on site
    const gasC = yearly('hk.energy.town-gas.combustion-co2e.', y);
    push(1, 'gas-c', ['煤氣燃燒', 'Town gas burnt on site'], num(v.gas), L('單位', 'unit'), gasC, { warn: yearWarn(gasC) });
    // Scope 1: stationary fuels, CO2 + CH4 + N2O
    const ST = [['st-diesel', 'diesel', ['柴油', 'Diesel'], 'L'], ['st-lpg', 'lpg', ['石油氣', 'LPG'], 'kg'], ['st-kerosene', 'kerosene', ['火水', 'Kerosene'], 'L']];
    for (const [k, fuel, n, unit] of ST) {
      const q = num(v[k]);
      push(1, k, [`${n[0]}（固定燃燒）二氧化碳`, `${n[1]} (stationary) CO₂`], q, unit, byId.get(`hk.energy.fuel.${fuel}.stationary.co2.emsd2010`));
      push(1, `${k}-ch4`, [`${n[0]}（固定燃燒）甲烷`, `${n[1]} (stationary) CH₄`], q, unit, byId.get(`hk.energy.fuel.${fuel}.stationary.ch4.emsd2010`), { gwp: AR2.CH4, toKg: 0.001 });
      push(1, `${k}-n2o`, [`${n[0]}（固定燃燒）氧化亞氮`, `${n[1]} (stationary) N₂O`], q, unit, byId.get(`hk.energy.fuel.${fuel}.stationary.n2o.emsd2010`), { gwp: AR2.N2O, toKg: 0.001 });
    }
    // Scope 1: vehicles
    d.veh.forEach((r, i) => {
      const q = num(r.litres); const n = [`${FUEL[r.fuel][0]} · ${VEH[r.type]?.[0] ?? ''}`, `${FUEL[r.fuel][1]} · ${VEH[r.type]?.[1] ?? ''}`];
      push(1, `veh${i}`, [`${n[0]} 二氧化碳`, `${n[1]} CO₂`], q, 'L', mobileCo2(r.fuel));
      push(1, `veh${i}-ch4`, [`${n[0]} 甲烷`, `${n[1]} CH₄`], q, 'L', byId.get(`hk.energy.fuel.${r.fuel}.mobile-${r.type}.ch4.emsd2010`), { gwp: AR2.CH4, toKg: 0.001 });
      push(1, `veh${i}-n2o`, [`${n[0]} 氧化亞氮`, `${n[1]} N₂O`], q, 'L', byId.get(`hk.energy.fuel.${r.fuel}.mobile-${r.type}.n2o.emsd2010`), { gwp: AR2.N2O, toKg: 0.001 });
    });
    // Scope 1: refrigerants, (Cs + Ci - Cd - Ce) x GWP
    d.ref.forEach((r, i) => {
      const f = byId.get(r.id); if (!f) return;
      const net = num(r.cs) + num(r.ci) - num(r.cd) - num(r.ce);
      if (net < 0) out.push({ scope: 1, key: `ref${i}`, name: [`冷媒 ${refName(f)}`, `Refrigerant ${refName(f)}`], qty: net, unit: 'kg', f, kg: 0, warn: L('計算結果是負數，請檢查存量；此行不計入', 'Negative result; check the stock figures. Not counted') });
      else push(1, `ref${i}`, [`冷媒 ${refName(f)}`, `Refrigerant ${refName(f)}`], net, 'kg', f);
    });
    // Scope 3 (optional)
    const water = yearly('hk.water.fresh-water.wsd.', y), sew = yearly('hk.water.sewage.dsd.', y);
    push(3, 'water', ['食水處理及供應', 'Fresh water supply'], num(v.water), 'm³', water, { warn: yearWarn(water) });
    const ratio = v.sewage === undefined || v.sewage === '' ? 1 : parseFloat(v.sewage);
    push(3, 'sewage', [`污水處理（食水用量 × ${Math.round(ratio * 100)}%）`, `Sewage (water × ${Math.round(ratio * 100)}%)`], num(v.water) * ratio, 'm³', sew, { warn: yearWarn(sew) });
    const paper = num(v['p-start']) + num(v['p-buy']) - num(v['p-recycle']) - num(v['p-end']);
    push(3, 'paper', ['紙張棄置堆填（期初 + 購入 − 回收 − 期末）', 'Paper to landfill (start + bought − recycled − end)'], paper, 'kg', byId.get('hk.waste.landfill.paper.emsd2010'));
    return out;
  }

  /* ---------- output ---------- */
  const SCOPE = { 1: ['範圍 1 · 直接排放', 'Scope 1 · Direct'], 2: ['範圍 2 · 能源間接排放', 'Scope 2 · Energy indirect'], 3: ['範圍 3 · 其他間接排放（自願）', 'Scope 3 · Other indirect (optional)'] };
  function render() {
    if (!D) return;
    const ls = lines();
    const sum = (s) => ls.filter((l) => l.scope === s).reduce((a, l) => a + l.kg, 0);
    const s1 = sum(1), s2 = sum(2), s3 = sum(3);
    const out = $('#biz-out');
    const title = `${st.org ? `${esc(st.org)} · ` : ''}${esc(L(`${st.year} 年`, String(st.year)))}`;
    out.innerHTML = `
      <div class="bo-head">
        <p class="bo-k">${title}</p>
        <div class="bo-tot">
          <div style="--c:var(--c-fuel)"><span>${esc(L('範圍 1', 'Scope 1'))}</span><b>${esc(tFmt(s1))}</b></div>
          <div style="--c:var(--c-elec)"><span>${esc(L('範圍 2', 'Scope 2'))}</span><b>${esc(tFmt(s2))}</b></div>
          <div class="sum"><span>${esc(L('範圍 1 + 2', 'Scope 1 + 2'))}</span><b>${esc(tFmt(s1 + s2))}</b></div>
          <div style="--c:var(--c-water)" class="opt"><span>${esc(L('範圍 3（自願）', 'Scope 3 (optional)'))}</span><b>${esc(tFmt(s3))}</b></div>
        </div>
        <p class="bo-unit">${esc(L('公噸二氧化碳當量（tCO₂e）', 'tonnes CO₂e'))}</p>
        ${window.HKOC?.treesHtml ? window.HKOC.treesHtml(s1 + s2, D.factors, { label: L('範圍 1 + 2：', 'Scope 1 + 2: '), note: L('只作直觀比較；種樹不計入範圍 1、2，也不能用來抵銷申報的排放。', 'A comparison only; trees are not part of scope 1 or 2 and cannot offset reported emissions.') }) : ''}
        <div class="bo-actions"><button type="button" class="pill pill-solid" data-csv${ls.length ? '' : ' disabled'}>${esc(L('下載 CSV', 'Download CSV'))}</button><button type="button" class="pill" data-print${ls.length ? '' : ' disabled'}>${esc(L('列印／存成 PDF', 'Print / save as PDF'))}</button></div>
      </div>
      ${ls.length ? [1, 2, 3].map((s) => {
        const g = ls.filter((l) => l.scope === s);
        if (!g.length) return '';
        return `<table class="bo-table"><caption>${esc(L(...SCOPE[s]))}<span>${esc(tFmt(sum(s)))} t</span></caption>
          <thead><tr><th>${esc(L('項目', 'Item'))}</th><th>${esc(L('用量', 'Amount'))}</th><th>${esc(L('系數', 'Factor'))}</th><th>${esc(L('排放（kg CO₂e）', 'kg CO₂e'))}</th></tr></thead>
          <tbody>${g.map((l) => `<tr${l.warn ? ' class="warn"' : ''}><td>${esc(L(...l.name))}${l.warn ? `<small>${esc(l.warn)}</small>` : ''}</td>
            <td>${esc(fmt(l.qty, l.qty < 10 ? 2 : 0))} ${esc(l.unit)}</td>
            <td><a href="index.html#f=${encodeURIComponent(l.f.id)}">${esc(l.f.value_text)} ${esc(l.f.unit)}</a>${l.gwp ? ` × GWP ${l.gwp}` : ''}<small>${esc(srcById.get(l.f.source.id)?.[lang() === 'en' ? 'title' : 'title_zh'] || l.f.source.id)}${l.f.year ? ` · ${l.f.year}` : ''}</small></td>
            <td class="n">${esc(kgFmt(l.kg))}</td></tr>`).join('')}</tbody></table>`;
      }).join('') : `<p class="bo-empty">${esc(L('填上全年用量，結果會即時顯示。', 'Enter your yearly usage; the result updates as you type.'))}</p>`}
      ${compareHtml()}
      <div class="bo-notes">
        <p>${esc(L('方法：按機電署及環保署《香港建築物（商業、住宅或公共用途）的溫室氣體排放及減除的核算和報告指引》（2010）。範圍 2 包括外購電力及煤氣；煤氣用量同時計入範圍 1（燃燒）及範圍 2（生產）。甲烷、氧化亞氮按指引採用的 GWP 21、310 換算；冷媒用指引表 3-1 的 GWP；電力公司系數的 GWP 版本原文未註明（港燈 2025 年起為 AR5）。', 'Method: EMSD/EPD Guidelines to Account for and Report on GHG Emissions and Removals for Buildings in Hong Kong (2010). Scope 2 covers purchased electricity and town gas; town gas counts in scope 1 (burning) and scope 2 (production). CH₄ and N₂O use the guidelines’ GWPs of 21 and 310; refrigerants use the guidelines’ Table 3-1; the power companies do not state their GWP set (HK Electric uses AR5 from 2025).'))}</p>
        <p>${esc(L('數據僅供參考；正式披露（例如港交所 ESG 報告）請以官方公佈及核查機構意見為準。範圍 1 只包括上面列出的排放源。', 'For reference only; for formal disclosure (e.g. HKEX ESG reports) rely on official publications and your verifier. Scope 1 covers only the sources listed above.'))}</p>
      </div>`;
  }

  /* ---------- year-on-year ---------- */
  function yearTotals() {
    return Object.keys(st.saved).map(Number).sort((a, b) => a - b).map((y) => {
      const ls = lines({ year: y, ...st.saved[y] });
      const sum = (s) => ls.filter((l) => l.scope === s).reduce((a, l) => a + l.kg, 0);
      const kwh = num(st.saved[y].v.clp) + num(st.saved[y].v.hke);
      return { y, s1: sum(1), s2: sum(2), s3: sum(3), kwh };
    });
  }
  function compareHtml() {
    const ys = yearTotals();
    const prevYear = Object.keys(st.saved).map(Number).filter((y) => y !== st.year).sort((a, b) => Math.abs(a - st.year) - Math.abs(b - st.year) || b - a)[0];
    const copy = !st.saved[st.year] && prevYear ? `<p class="bo-copy">${esc(L(`${st.year} 年未有數字。`, `No figures for ${st.year} yet.`))} <button type="button" class="pill pill-sm" data-copy-year="${prevYear}">${esc(L(`複製 ${prevYear} 年的用量來改`, `Start from ${prevYear}'s figures`))}</button></p>` : '';
    if (ys.length < 2) return copy + (ys.length === 1 && ys[0].y === st.year ? `<p class="bo-hint">${esc(L('換另一個報告年份並填上數字，這裡會出現逐年比較。每年的數字分開保存在這個瀏覽器。', 'Pick another reporting year and enter its figures to compare years. Each year is saved separately in this browser.'))}</p>` : '');
    const max = Math.max(...ys.map((r) => r.s1 + r.s2), 1);
    const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const chg = (v) => (v === null ? '—' : `<span class="${v < -0.05 ? 'down' : v > 0.05 ? 'up' : 'flat'}">${v < -0.05 ? '↓' : v > 0.05 ? '↑' : '→'} ${Math.abs(v).toFixed(1)}%</span>`);
    return `${copy}<section class="bo-yoy">
      <h3>${esc(L('逐年比較', 'Year on year'))}</h3>
      <table class="bo-table yoy"><thead><tr><th>${esc(L('年份', 'Year'))}</th><th>${esc(L('範圍 1', 'Scope 1'))}</th><th>${esc(L('範圍 2', 'Scope 2'))}</th><th>${esc(L('範圍 1 + 2', 'Scope 1 + 2'))}</th><th>${esc(L('對比上一年', 'vs year before'))}</th><th>${esc(L('範圍 3', 'Scope 3'))}</th></tr></thead>
      <tbody>${ys.map((r, i) => `<tr${r.y === st.year ? ' class="on"' : ''}><td><button type="button" class="yoy-y" data-go-year="${r.y}">${r.y}</button><span class="yoy-bar"><i style="width:${(((r.s1 + r.s2) / max) * 100).toFixed(1)}%"></i></span></td>
        <td class="n">${esc(tFmt(r.s1))}</td><td class="n">${esc(tFmt(r.s2))}</td><td class="n"><b>${esc(tFmt(r.s1 + r.s2))}</b></td><td class="n">${i ? chg(pct(r.s1 + r.s2, ys[i - 1].s1 + ys[i - 1].s2)) : '—'}</td><td class="n">${esc(tFmt(r.s3))}</td></tr>`).join('')}</tbody></table>
      <p class="bo-unit">${esc(L('公噸二氧化碳當量。每年用該年的系數（沒有該年系數時用最接近的較早年份），所以變化同時反映用量和電力公司排放強度的變化。點年份可切換。', 'tonnes CO₂e. Each year uses that year’s factors (or the closest earlier year), so changes reflect both your usage and the power company’s emission intensity. Click a year to open it.'))}
        <button type="button" class="linkish" data-yoy-csv>${esc(L('下載比較 CSV', 'Download comparison (CSV)'))}</button></p>
    </section>`;
  }

  /* ---------- export ---------- */
  $('#biz-out').addEventListener('click', (e) => {
    const go = e.target.closest('[data-go-year]');
    if (go) { switchYear(go.dataset.goYear); return; }
    const cp = e.target.closest('[data-copy-year]');
    if (cp) { Object.assign(st, JSON.parse(JSON.stringify(st.saved[cp.dataset.copyYear]))); fill(); save(); render(); return; }
    if (e.target.closest('[data-yoy-csv]')) {
      const rows = yearTotals().map((r) => [r.y, Math.round(r.s1), Math.round(r.s2), Math.round(r.s1 + r.s2), Math.round(r.s3), r.kwh].join(','));
      const blob = new Blob([`\uFEFF# ${st.org || ''} kg CO2e by reporting year. HK Open Carbon Platform, data version ${D.built}.\nyear,scope1_kg,scope2_kg,scope1_2_kg,scope3_kg,electricity_kwh\n${rows.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.setAttribute('download', `hk-carbon-years${st.org ? `-${st.org.replace(/[^\w\u4e00-\u9fff-]+/g, '_')}` : ''}.csv`);
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    if (!e.target.closest('[data-csv]')) return;
    const ls = lines();
    const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const head = ['scope', 'item', 'amount', 'unit', 'factor_id', 'factor_value', 'factor_unit', 'gwp_applied', 'kg_co2e', 'factor_year', 'source', 'note'];
    const body = ls.map((l) => [l.scope, L(...l.name), l.qty, l.unit, l.f.id, l.f.value_text, l.f.unit, l.gwp ?? '', Math.round(l.kg * 1000) / 1000, l.f.year ?? '', srcById.get(l.f.source.id)?.title || l.f.source.id, l.warn || ''].map(q).join(','));
    const meta = [`# ${st.org || ''} ${st.year}`, `# HK Open Carbon Platform, data version ${D.built}. Factors: CC BY 4.0. https://liuxiangchen428-hash.github.io/hk-open-carbon/business.html`];
    const blob = new Blob([`﻿${[...meta, head.join(','), ...body].join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.setAttribute('download', `hk-carbon-${st.year}${st.org ? `-${st.org.replace(/[^\w\u4e00-\u9fff-]+/g, '_')}` : ''}.csv`);
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
})();
