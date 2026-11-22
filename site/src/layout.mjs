// Shared page shell: head, header, footer.
// Static text is written in both languages; CSS shows one based on
// <html data-lang="zh"|"en"> (set by assets/app.js, remembered per browser).

import { AI_ENDPOINT } from './config.mjs';

export const t = (zh, en) => `<span class="l-zh">${zh}</span><span class="l-en">${en}</span>`;

const REPO = 'https://github.com/liuxiangchen428-hash/hk-open-carbon';

const nav = [
  { file: 'index.html', zh: '系數庫', en: 'Factors' },
  { file: 'calculator.html', zh: '計算器', en: 'Calculator' },
  { file: 'inventory.html', zh: '排放清單', en: 'Inventory' },
  { file: 'sources.html', zh: '來源與方法', en: 'Sources & method' },
];

const mark = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--accent)"/>
  <path d="M9 21.5c0-6 4.2-10.5 10.5-11.5-1 3.2-1.2 6.4 0 9.5-3.4-.6-6.9.3-10.5 2Z" fill="var(--on-accent)"/>
  <path d="M9 21.5c3.6-2.6 7.2-4.3 11-5" stroke="var(--accent)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
</svg>`;

export function layout({ file, title, description, body, stats }) {
  const links = nav
    .map((n) => `<a href="${n.file}"${n.file === file ? ' aria-current="page"' : ''}>${t(n.zh, n.en)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="zh-Hant" data-lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.zh} · 香港開源碳核算平台</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css">
<script>try{var l=localStorage.getItem('hkoc-lang');if(l)document.documentElement.dataset.lang=l;}catch(e){}</script>
</head>
<body data-page="${file.replace('.html', '')}"${AI_ENDPOINT ? ` data-ai="${AI_ENDPOINT}"` : ''}>
<a class="skip" href="#main">${t('跳到內容', 'Skip to content')}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="index.html">
      ${mark}
      <span class="brand-text">
        <span class="brand-name">${t('香港開源碳核算平台', 'HK Open Carbon Platform')}</span>
        <span class="brand-sub">${t('HK Open Carbon Platform', '香港開源碳核算平台')}</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Main">${links}</nav>
    <button class="lang-toggle" type="button" data-lang-toggle aria-label="Switch language / 切換語言">
      <span class="l-zh">EN</span><span class="l-en">繁</span>
    </button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <div>
      <p class="footer-title">${t('香港開源碳核算平台', 'HK Open Carbon Platform')}</p>
      <p class="muted">${t(
        '開源、免費、可溯源的香港本地碳排放系數。數據僅供參考；正式披露請以官方公佈及核查機構意見為準。',
        'Open, free and fully sourced emission factors for Hong Kong. For reference only; for formal disclosure rely on official publications and your verifier.',
      )}</p>
    </div>
    <div class="footer-meta">
      <p>${t('數據', 'Data')} <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · ${t('程式碼', 'Code')} Apache-2.0</p>
      <p>${t('數據版本', 'Data version')} ${stats.built} · <a href="api/v1/factors.json">JSON</a> · <a href="${REPO}">GitHub</a></p>
      <p>${t('聯絡', 'Contact')} <a href="mailto:xiangchenliu@ln.hk">xiangchenliu@ln.hk</a></p>
    </div>
  </div>
</footer>
<script src="assets/app.js" defer></script>
</body>
</html>
`;
}
