// Page bodies. Dynamic parts (factor list, detail panel, sources table) are
// rendered in the browser by assets/app.js from assets/data.json.
import { t } from './layout.mjs';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const index = (s) => `
<section class="hero">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <p class="eyebrow">${t('香港本地排放系數庫', 'Hong Kong emission factor library')}</p>
      <h1>${t('每一個數字，<br>都找得到出處。', 'Every number,<br>traceable to its source.')}</h1>
      <p class="lede">${t(
        '整理自政府指引、公用事業及營運商公開報告的碳排放系數。每個數值都附原文頁碼與存檔，並經兩次獨立核對。',
        'Emission factors compiled from Hong Kong government guidelines and published utility and operator reports. Every value cites its page and archive copy, and is read twice independently.',
      )}</p>
    </div>
    <dl class="hero-stats">
      <div><dt>${t('排放系數', 'Factors')}</dt><dd>${s.factors}</dd></div>
      <div><dt>${t('已審核', 'Reviewed')}</dt><dd>${pct(s.reviewed, s.factors)}<small>%</small></dd></div>
      <div><dt>${t('引用來源', 'Sources cited')}</dt><dd>${s.sources}</dd></div>
    </dl>
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
<aside class="drawer" id="drawer" aria-hidden="true" aria-labelledby="d-title" role="dialog">
  <div class="drawer-inner" id="drawer-body"></div>
</aside>
`;

const sources = () => `
<section class="page-head wrap">
  <p class="eyebrow">${t('來源登記', 'Source registry')}</p>
  <h1>${t('來源', 'Sources')}</h1>
  <p class="lede">${t(
    '本平台使用或計劃使用的全部文件。每份文件都記錄出版機構、原始連結、Internet Archive 存檔及再使用條款。',
    'Every document the platform uses or plans to use, with publisher, original link, Internet Archive copy and reuse terms.',
  )}</p>
</section>
<section class="wrap">
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

const methodology = () => `
<section class="page-head wrap">
  <p class="eyebrow">${t('方法', 'Methodology')}</p>
  <h1>${t('數據怎樣來、怎樣核對', 'Where the data comes from, and how it is checked')}</h1>
  <p class="lede">${t(
    '本平台由一名維護者在 AI 助手協助下維護。為了在人手有限的情況下保證準確，我們用公開、可重複的規則處理每一個數值。',
    'The platform is maintained by one person with help from an AI assistant. To stay accurate with a small team, every value goes through the same open, repeatable rules.',
  )}</p>
</section>

<section class="wrap prose">
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
    </ul>
  </div>
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
    file: 'sources.html',
    title: { zh: '來源', en: 'Sources' },
    description: 'Source registry of the HK Open Carbon Platform.',
    body: sources,
  },
  {
    file: 'methodology.html',
    title: { zh: '方法', en: 'Methodology' },
    description: 'How emission factors are sourced and checked.',
    body: methodology,
  },
];
