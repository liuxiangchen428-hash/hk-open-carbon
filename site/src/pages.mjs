// Page bodies. Dynamic parts (factor list, detail panel, sources table) are
// rendered in the browser by assets/app.js from assets/data.json.
import { t } from './layout.mjs';

const index = (s) => `
<section class="hero">
  <div class="wrap">
    <div class="hb">
      <h1>${t('香港碳排放<br>系數庫', 'Hong Kong<br>emission factors')}<small>${t(`每個數字都附原文頁碼 · ${s.factors} 個系數`, `Every number cites its page · ${s.factors} factors`)}</small></h1>
      <div>
        <form class="hsearch" id="hsearch" role="search">
          <input id="hq" type="search" autocomplete="off" spellcheck="false" aria-label="Search">
          <button type="submit">${t('搜尋', 'Search')}</button>
        </form>
        <div class="hchips" id="hchips">${t('常用：', 'Popular:')}
          <button type="button" data-hq="中電">${t('中電用電', 'CLP')}</button>
          <button type="button" data-hq="港燈">${t('港燈用電', 'HK Electric')}</button>
          <button type="button" data-hq="煤氣">${t('煤氣', 'Town gas')}</button>
          <button type="button" data-hq="港鐵">${t('港鐵', 'MTR')}</button>
          <button type="button" data-hq="食水">${t('食水', 'Water')}</button>
          <button type="button" data-hq="冷">${t('冷氣雪種', 'Refrigerants')}</button>
        </div>
      </div>
    </div>
    <div class="dash" id="dash">
      <div class="dash-tabs" id="dash-tabs" role="tablist" aria-label="${'Key factors'}"></div>
      <div class="dash-panel">
        <div class="dash-head">
          <div><p class="dash-title" id="dash-title"></p><p class="dash-sub" id="dash-sub"></p></div>
          <div class="dash-actions" id="dash-actions"></div>
        </div>
        <div class="dash-chart" id="dash-chart"></div>
        <div class="dash-foot" id="dash-foot"></div>
      </div>
    </div>
  </div>
</section>

<section class="wrap browser" aria-label="Factor library">
  <aside class="filters" id="filters">
    <label class="search">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>
      <input id="q" type="search" autocomplete="off" spellcheck="false">
    </label>
    <div class="filter-block">
      <p class="filter-title">${t('類別', 'Category')}</p>
      <ul id="cat-list" class="cat-list"></ul>
    </div>
    <div class="filter-block">
      <p class="filter-title">${t('核對狀態', 'Status')}</p>
      <div class="seg" id="status-seg" role="radiogroup">
        <button type="button" data-status="all" aria-pressed="true">${t('全部', 'All')}</button>
        <button type="button" data-status="reviewed" aria-pressed="false">${t('已審核', 'Reviewed')}</button>
        <button type="button" data-status="draft" aria-pressed="false">${t('草稿', 'Draft')}</button>
      </div>
    </div>
    <div class="filter-block legend">
      <p class="filter-title">${t('品質等級', 'Quality')}</p>
      <dl>
        <div><dt><span class="q q-A">A</span></dt><dd>${t('香港政府', 'HK government')}</dd></div>
        <div><dt><span class="q q-B">B</span></dt><dd>${t('本地企業或機構', 'Local company or body')}</dd></div>
        <div><dt><span class="q q-C">C</span></dt><dd>${t('國際預設值', 'International default')}</dd></div>
        <div><dt><span class="q q-D">D</span></dt><dd>${t('推算值', 'Derived')}</dd></div>
      </dl>
    </div>
    <div class="filter-block about-data">
      <p class="filter-title">${t('關於數據', 'About the data')}</p>
      <dl class="mini-stats">
        <div><dt>${t('系數', 'Factors')}</dt><dd>${s.factors}</dd></div>
        <div><dt>${t('已審核', 'Reviewed')}</dt><dd>${s.reviewed}</dd></div>
        <div><dt>${t('來源', 'Sources')}</dt><dd>${s.sources}</dd></div>
      </dl>
      <p>${t(
        '整理自政府指引及公用事業、營運商公開報告。每個數值附原文頁碼與存檔，並經兩次獨立核對。',
        'Compiled from HK government guidelines and published utility and operator reports. Each value cites its page and archive copy and is read twice.',
      )}</p>
      <a href="sources.html#method">${t('了解核對方法 →', 'How values are checked →')}</a>
    </div>
  </aside>

  <div class="results">
    <div class="results-bar">
      <p id="count" class="muted" aria-live="polite"></p>
      <button class="filters-toggle" type="button" data-filters-toggle>${t('篩選', 'Filters')}</button>
    </div>
    <div id="groups"></div>
    <p id="empty" class="empty" hidden>${t('沒有符合條件的系數。', 'No factors match these filters.')}</p>
  </div>
</section>

<div class="drawer-scrim" data-close hidden></div>
<aside class="drawer" id="drawer" aria-hidden="true" aria-labelledby="d-title" role="dialog" tabindex="-1">
  <div class="drawer-inner" id="drawer-body"></div>
</aside>
`;

const sources = () => `
<section class="page-head"><div class="wrap">
  <p class="eyebrow">${t('來源與方法', 'Sources and method')}</p>
  <h1>${t('數據怎樣來、怎樣核對', 'Where the data comes from, and how it is checked')}</h1>
  <p class="lede">${t(
    '本平台由一名維護者在 AI 助手協助下維護。每個數值都來自公開原文，經兩次獨立讀取，並保留存檔。下面先說明方法，再列出全部來源。',
    'The platform is maintained by one person with help from an AI assistant. Every value comes from a published source, is read twice and keeps an archive copy. The method comes first, then the full source list.',
  )}</p>
  <p class="page-jump"><a href="#method">${t('方法', 'Method')}</a> · <a href="#registry">${t('來源登記', 'Source registry')}</a></p>
</div></section>

<section class="wrap prose" id="method">
  <div class="steps">
    <article>
      <span class="step-n">01</span>
      <h2>${t('只用公開原文', 'Published sources only')}</h2>
      <p>${t(
        '數值必須照抄自政府指引、公用事業或營運商的公開報告，並記錄 PDF 頁碼與報告印刷頁碼。原文沒有直接公佈的數字，經維護者同意才會推算，並標為 D 級、寫明算式。',
        'Values are copied from government guidelines and published utility or operator reports, with both the PDF page and the printed page recorded. A value the source does not publish is derived only with the maintainer’s approval, marked quality D and shown with its arithmetic.',
      )}</p>
    </article>
    <article>
      <span class="step-n">02</span>
      <h2>${t('兩次獨立讀取', 'Read twice, independently')}</h2>
      <p>${t(
        '每個數值由 AI 助手從原文讀取一次，再由維護者打開原文該頁目視核對一次。兩次結果由程式自動比對，不一致就無法合併。只有兩次一致的數值才標為「已審核」。',
        'The AI assistant reads each value from the source; the maintainer then checks it on the page. A program compares the two readings and blocks any mismatch. Only values with two matching readings are marked “reviewed”.',
      )}</p>
    </article>
    <article>
      <span class="step-n">03</span>
      <h2>${t('保存證據', 'Keep the evidence')}</h2>
      <p>${t(
        '每份來源都在 Internet Archive 保留存檔，每月自動更新，原連結失效也找得到原文。所有修改記錄在 Git，任何版本都可以追溯。',
        'Every source has an Internet Archive copy, refreshed monthly, so the original can be found even if its link breaks. Every change is recorded in Git and any version can be traced.',
      )}</p>
    </article>
  </div>

  <div class="two-col">
    <div>
      <h2>${t('品質等級', 'Quality levels')}</h2>
      <table class="plain">
        <tbody>
          <tr><td><span class="q q-A">A</span></td><td>${t('香港政府官方公佈，例如機電署及環保署的建築物溫室氣體指引。', 'Published by the HK government, e.g. the EMSD/EPD building GHG guidelines.')}</td></tr>
          <tr><td><span class="q q-B">B</span></td><td>${t('香港公用事業、企業或機構公佈，例如中電、港燈、煤氣、港鐵的報告。', 'Published by HK utilities, companies or bodies, e.g. CLP, HK Electric, Towngas, MTR.')}</td></tr>
          <tr><td><span class="q q-C">C</span></td><td>${t('國際權威預設值或同行評審文獻，例如 IPCC 指南。', 'International defaults or peer-reviewed literature, e.g. IPCC guidelines.')}</td></tr>
          <tr><td><span class="q q-D">D</span></td><td>${t('本平台推算，必須附算式及所用數字。', 'Derived by the platform, always with the arithmetic and inputs.')}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>${t('怎樣使用', 'How to use a factor')}</h2>
      <p>${t('排放 = 活動量 × 排放系數。例如一個中電供電區的辦公室在 2025 年用電 12,000 度：', 'Emissions = activity × factor. For example, an office in the CLP supply area using 12,000 kWh in 2025:')}</p>
      <p class="formula">12,000 kWh × 0.34 kg CO₂e/kWh = <strong>4,080 kg CO₂e</strong></p>
      <p>${t(
        '請選用與活動同一年份、同一地區（中電或港燈供電區）的系數；有香港本地系數時，應優先於國際預設值。',
        'Use the factor for the same year and area (CLP or HK Electric supply area) as the activity, and prefer a Hong Kong factor over an international default.',
      )}</p>
    </div>
  </div>

  <div class="note-box">
    <h2>${t('限制與免責', 'Limitations')}</h2>
    <ul>
      <li>${t('AI 助手可能讀錯表格或單位；維護者的目視核對是最後把關。發現錯誤請在 GitHub 開 Issue。', 'The AI assistant can misread tables or units; the maintainer’s visual check is the final safeguard. Please report errors as a GitHub issue.')}</li>
      <li>${t('部分來源沒有註明所用的全球暖化潛勢（GWP）版本，資料中會標示「原文未註明」。', 'Some sources do not state which GWP set they use; these are marked “not stated”.')}</li>
      <li>${t('數據僅供參考。正式披露（例如港交所 ESG 報告）請以官方公佈及核查機構意見為準。', 'For reference only. For formal disclosure (e.g. HKEX ESG reports) rely on official publications and your verifier.')}</li>
      <li>${t('計算器的輸入只留在你的瀏覽器。AI 助手是例外：你的問題會送到 Cloudflare Workers AI 由開源模型處理，本平台不保存問題內容；請勿輸入個人資料。', 'Calculator inputs stay in your browser. The AI assistant is the exception: your question is sent to Cloudflare Workers AI and answered by an open model; this platform does not keep it. Do not enter personal data.')}</li>
    </ul>
  </div>
</section>

<section class="wrap registry" id="registry">
  <h2 class="section-title">${t('來源登記', 'Source registry')}</h2>
  <p class="muted section-lede">${t(
    '本平台使用或計劃使用的全部文件，附出版機構、原始連結、Internet Archive 存檔及再使用條款。',
    'Every document the platform uses or plans to use, with publisher, original link, Internet Archive copy and reuse terms.',
  )}</p>
  <div class="source-tools">
    <label class="search">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>
      <input id="sq" type="search" autocomplete="off" spellcheck="false">
    </label>
    <label class="check"><input type="checkbox" id="used-only" checked> ${t('只顯示已引用', 'Cited only')}</label>
  </div>
  <div class="table-wrap">
    <table class="sources-table">
      <thead><tr>
        <th>${t('文件', 'Document')}</th>
        <th>${t('出版機構', 'Publisher')}</th>
        <th>${t('版本', 'Edition')}</th>
        <th>${t('連結', 'Links')}</th>
      </tr></thead>
      <tbody id="sources-body"></tbody>
    </table>
  </div>
</section>
`;


const inventory = () => `
<section class="hero inv-hero">
  <div class="wrap">
    <div class="hero-top">
      <p class="eyebrow">${t('全港溫室氣體排放清單', 'Hong Kong greenhouse gas inventory')}</p>
      <h1>${t('全港排放，<span class="nb">由 1990 年到今天。</span>', 'Hong Kong’s emissions, <span class="nb">1990 to today.</span>')}</h1>
    </div>
    <div class="inv-kpis" id="inv-kpis"></div>
    <div class="inv-panel">
      <div class="dash-head">
        <div><p class="dash-title" id="inv-title"></p><p class="dash-sub" id="inv-sub"></p></div>
        <div class="inv-actions">
          <div class="seg seg-band" id="inv-metric" role="radiogroup" aria-label="Measure">
            <button type="button" data-metric="total" aria-pressed="true">${t('總排放', 'Total')}</button>
            <button type="button" data-metric="per_capita" aria-pressed="false">${t('人均', 'Per capita')}</button>
            <button type="button" data-metric="intensity" aria-pressed="false">${t('碳強度', 'Intensity')}</button>
          </div>
          <div class="seg seg-band" id="inv-range" role="radiogroup" aria-label="Years">
            <button type="button" data-from="2005" aria-pressed="true">${t('2005 起', 'From 2005')}</button>
            <button type="button" data-from="1990" aria-pressed="false">${t('1990 起', 'From 1990')}</button>
          </div>
        </div>
      </div>
      <div class="dash-chart inv-chart" id="inv-chart"></div>
      <div class="dash-foot inv-foot" id="inv-foot"></div>
    </div>
    <p class="inv-goal-note" id="inv-goal-note"></p>
  </div>
</section>

<section class="wrap inv-body">
  <div class="group-head">
    <h2>${t('按排放源', 'By sector')}</h2>
    <span class="sub" id="sec-year"></span>
    <div class="inv-tools">
      <div class="seg" id="sec-view" role="radiogroup" aria-label="View">
        <button type="button" data-view="bars" aria-pressed="true">${t('圖表', 'Chart')}</button>
        <button type="button" data-view="table" aria-pressed="false">${t('表格', 'Table')}</button>
      </div>
    </div>
  </div>
  <p class="inv-hint muted">${t('在上方圖表點選年份，可查看該年的分項。', 'Pick a year in the chart above to see its breakdown.')}</p>
  <div id="inv-sectors"></div>
  <div class="two-col inv-notes">
    <div>
      <h2>${t('關於這份清單', 'About this inventory')}</h2>
      <div id="inv-about"></div>
    </div>
    <div>
      <h2>${t('出處', 'Sources')}</h2>
      <div id="inv-sources"></div>
    </div>
  </div>
</section>
`;

const period = (name) => `<select class="calc-period" data-period="${name}" aria-label="Billing period">
  <option value="1">${'每月 / month'}</option>
  <option value="2">${'每兩個月 / 2 months'}</option>
  <option value="4">${'每四個月 / 4 months'}</option>
  <option value="12">${'全年 / year'}</option>
</select>`;

const calculator = () => `
<section class="hero calc-hero">
  <div class="wrap">
    <div class="hero-top">
      <p class="eyebrow">${t('家庭碳足跡計算器', 'Household carbon calculator')}</p>
      <h1>${t('你家一年，<span class="nb">排放多少？</span>', 'How much does your home <span class="nb">emit in a year?</span>')}</h1>
      <p class="hero-lede">${t('拿出電費、煤氣費和水費單，填上用量和帳單涵蓋的時間。計算只在你的瀏覽器進行，不會上傳。', 'Take your electricity, gas and water bills and enter the usage and billing period. Everything is calculated in your browser; nothing is uploaded.')}</p>
    </div>
    <div class="hh">
      <form class="hh-form" id="hh-form" autocomplete="off">
        <div class="hh-row hh-top">
          <label class="hh-field"><span>${t('住戶人數', 'People in the home')}</span>
            <input type="number" id="hh-people" min="1" max="20" step="1" value="1" inputmode="numeric"></label>
          <label class="hh-field"><span>${t('帳單年份', 'Bill year')}</span>
            <select id="hh-year"></select></label>
        </div>

        <fieldset class="hh-sec">
          <legend><span class="hh-ico e" aria-hidden="true"></span>${t('電力', 'Electricity')}</legend>
          <div class="seg seg-band" id="hh-supplier" role="radiogroup" aria-label="Supplier">
            <button type="button" data-supplier="clp" aria-pressed="true">${t('中電', 'CLP')}</button>
            <button type="button" data-supplier="hke" aria-pressed="false">${t('港燈', 'HK Electric')}</button>
          </div>
          <div class="hh-row">
            <label class="hh-field grow"><span>${t('用電量（度 / kWh）', 'Usage (kWh)')}</span>
              <input type="number" id="hh-kwh" min="0" step="any" inputmode="decimal" placeholder="0"></label>
            <label class="hh-field"><span>${t('帳單涵蓋', 'Bill covers')}</span>${period('kwh')}</label>
          </div>
        </fieldset>

        <fieldset class="hh-sec">
          <legend><span class="hh-ico g" aria-hidden="true"></span>${t('煤氣', 'Town gas')}</legend>
          <div class="hh-row">
            <label class="hh-field grow"><span>${t('用量（單位，1 單位 = 48 兆焦耳）', 'Usage (units; 1 unit = 48 MJ)')}</span>
              <input type="number" id="hh-gas" min="0" step="any" inputmode="decimal" placeholder="0"></label>
            <label class="hh-field"><span>${t('帳單涵蓋', 'Bill covers')}</span>${period('gas')}</label>
          </div>
        </fieldset>

        <fieldset class="hh-sec">
          <legend><span class="hh-ico w" aria-hidden="true"></span>${t('食水', 'Water')}</legend>
          <div class="hh-row">
            <label class="hh-field grow"><span>${t('用水量（立方米 / m³）', 'Usage (m³)')}</span>
              <input type="number" id="hh-water" min="0" step="any" inputmode="decimal" placeholder="0"></label>
            <label class="hh-field"><span>${t('帳單涵蓋', 'Bill covers')}</span>${period('water')}</label>
          </div>
          <label class="check check-band"><input type="checkbox" id="hh-sewage" checked> ${t('包括污水處理（住宅按用水量 100% 計）', 'Include sewage treatment (homes: 100% of water used)')}</label>
        </fieldset>

        <fieldset class="hh-sec">
          <legend><span class="hh-ico t" aria-hidden="true"></span>${t('交通', 'Transport')}</legend>
          <div class="hh-row">
            <label class="hh-field grow"><span>${t('港鐵：每週車程（程）', 'MTR: trips per week')}</span>
              <input type="number" id="hh-mtr-trips" min="0" step="any" inputmode="decimal" placeholder="0" data-needs="mtr"></label>
            <label class="hh-field"><span>${t('平均每程（公里）', 'Average km per trip')}</span>
              <input type="number" id="hh-mtr-km" min="0" step="any" inputmode="decimal" placeholder="0" data-needs="mtr"></label>
          </div>
          <div class="hh-row">
            <label class="hh-field grow"><span>${t('巴士：每週車程（程）', 'Bus: trips per week')}</span>
              <input type="number" id="hh-bus" min="0" step="any" inputmode="decimal" placeholder="0" data-needs="bus"></label>
          </div>
          <div class="hh-row">
            <label class="hh-field grow"><span>${t('私家車：每月入油（公升）', 'Car: fuel per month (litres)')}</span>
              <input type="number" id="hh-fuel" min="0" step="any" inputmode="decimal" placeholder="0"></label>
            <label class="hh-field"><span>${t('燃料', 'Fuel')}</span>
              <select id="hh-fuel-type"><option value="petrol">汽油 / Petrol</option><option value="diesel">柴油 / Diesel</option></select></label>
          </div>
          <p class="hh-pending" id="hh-pending" hidden></p>
        </fieldset>

        <div class="hh-actions">
          <button type="button" class="pill" data-example>${t('填入示例', 'Fill an example')}</button>
          <button type="button" class="pill" data-clear>${t('清除', 'Clear')}</button>
        </div>
      </form>

      <div class="hh-result" id="hh-result" aria-live="polite"></div>
      <a class="hh-sticky" id="hh-sticky" href="#hh-result" aria-live="off"></a>
    </div>
  </div>
</section>

<section class="wrap calc-body">
  <div class="group-head"><h2>${t('怎樣計算', 'How it is calculated')}</h2></div>
  <div id="hh-lines"></div>
  <div class="two-col inv-notes">
    <div>
      <h2>${t('計算範圍', 'What is counted')}</h2>
      <div id="hh-scope"></div>
    </div>
    <div>
      <h2>${t('使用的系數', 'Factors used')}</h2>
      <div id="hh-factors"></div>
    </div>
  </div>
</section>
`;


const map = () => `
<section class="page-head map-head"><div class="wrap">
  <p class="eyebrow">${t('香港碳地圖', 'Hong Kong carbon map')}</p>
  <h1>${t('十八區，<span class="nb">用電與發電。</span>', '18 districts, <span class="nb">power used and made.</span>')}</h1>
  <p class="lede">${t(
    '把滑鼠移到地區上看數字，點一下放大並查看歷年數據。所有數字照錄自電力公司及政府公佈，不作推算。',
    'Hover over a district to see its figures; click to zoom in and step through the years. Every number is copied from what the power companies and government publish; nothing is estimated.',
  )}</p>
</div></section>
<section class="wrap map-wrap">
  <div class="map-bar">
    <div class="seg" id="map-layer" role="radiogroup" aria-label="Layer">
      <button type="button" data-layer="supply" aria-pressed="true">${t('供電與排放系數', 'Supply & factor')}</button>
      <button type="button" data-layer="hke" aria-pressed="false">${t('港島用電', 'HK Island use')}</button>
      <button type="button" data-layer="solar" aria-pressed="false">${t('自家太陽能', 'Rooftop solar')}</button>
    </div>
    <label class="map-period" id="map-period-wrap" hidden><span id="map-period-label"></span><select id="map-period"></select></label>
  </div>
  <div class="map-grid">
    <div class="map-stage" id="map-stage">
      <svg id="map-svg" role="img" aria-label="Map of Hong Kong's 18 districts"></svg>
      <button type="button" class="map-back pill" id="map-back" hidden>← ${t('返回全港', 'All of Hong Kong')}</button>
      <div class="map-tip" id="map-tip" hidden></div>
      <div class="map-legend" id="map-legend"></div>
    </div>
    <button type="button" class="map-more" id="map-more" hidden></button>
    <aside class="map-panel" id="map-panel" aria-live="polite"></aside>
  </div>
  <div class="map-notes" id="map-notes"></div>
</section>
`;

export const pages = [
  {
    file: 'index.html',
    title: { zh: '系數庫', en: 'Factors' },
    description: 'Open, sourced emission factors for Hong Kong: electricity, town gas, fuels, water and more.',
    body: index,
  },
  {
    file: 'calculator.html',
    title: { zh: '計算器', en: 'Calculator' },
    description: 'Estimate your household carbon footprint from electricity, town gas and water bills, using Hong Kong factors.',
    body: calculator,
  },
  {
    file: 'inventory.html',
    title: { zh: '排放清單', en: 'Inventory' },
    description: 'Hong Kong greenhouse gas emissions by sector, 1990 to the latest year, from the government inventory.',
    body: inventory,
  },
  {
    file: 'map.html',
    title: { zh: '碳地圖', en: 'Carbon map' },
    description: 'Hong Kong district map: power supplier and emission factor, HK Electric consumption by district, and CLP customer solar by region.',
    body: map,
    script: 'map.js',
  },
  {
    file: 'sources.html',
    title: { zh: '來源與方法', en: 'Sources & method' },
    description: 'How the HK Open Carbon Platform sources and checks its emission factors, and the full source registry.',
    body: sources,
  },
];
