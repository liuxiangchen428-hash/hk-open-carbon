// Shared page shell: head, header, footer.
// Static text is written in both languages; CSS shows one based on
// <html data-lang="zh"|"en"> (set by assets/app.js, remembered per browser).

import { AI_ENDPOINT } from './config.mjs';

export const t = (zh, en) => `<span class="l-zh">${zh}</span><span class="l-en">${en}</span>`;

const REPO = 'https://github.com/liuxiangchen428-hash/hk-open-carbon';

const nav = [
  { file: 'index.html', zh: '系數庫', en: 'Factors', short: ['系數', 'Factors'], icon: '<path d="M4 5h12M4 10h12M4 15h8"/>' },
  { file: 'calculator.html', zh: '計算器', en: 'Calculator', short: ['計算', 'Calculate'], icon: '<rect x="4.5" y="3" width="11" height="14" rx="2"/><path d="M7.5 7h5M7.5 10.5h1M11.5 10.5h1M7.5 13.5h1M11.5 13.5h1"/>' },
  { file: 'inventory.html', zh: '排放清單', en: 'Inventory', short: ['清單', 'Inventory'], icon: '<path d="M4 16V10M8 16V6M12 16V8M16 16V4"/>' },
  { file: 'sources.html', zh: '來源與方法', en: 'Sources & method', short: ['來源', 'Sources'], icon: '<path d="M6 3h6l3 3v11H6z"/><path d="M12 3v3h3M8.5 10h4M8.5 13h4"/>' },
];

// Logo: an open "C" (carbon, open source) with a leaf in the opening.
const mark = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--mark-bg)" stroke="var(--mark-line)" stroke-width="1"/>
  <path d="M22.4 9.6A9 9 0 1 0 22.4 22.4" fill="none" stroke="var(--mark-c)" stroke-width="3" stroke-linecap="round"/>
  <path d="M19.5 16C19.5 12.4 22.2 10 26 9.6 26 13.6 23.6 16 19.5 16Z" fill="var(--mark-leaf)"/>
  <path d="M19.5 16C21.6 14.2 23.4 12.4 25 10.6" stroke="var(--mark-bg)" stroke-width=".9" fill="none" stroke-linecap="round"/>
</svg>`;

export function layout({ file, title, description, body, stats }) {
  const links = nav
    .map((n) => `<a href="${n.file}"${n.file === file ? ' aria-current="page"' : ''}>${t(n.zh, n.en)}</a>`)
    .join('');
  const tabs = nav
    .map((n) => `<a href="${n.file}"${n.file === file ? ' aria-current="page"' : ''}><svg viewBox="0 0 20 20" aria-hidden="true">${n.icon}</svg>${t(...n.short)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="zh-Hant" data-lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title.zh} · 香港開源碳核算平台</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<meta name="theme-color" content="#0b1d18">
<link rel="stylesheet" href="assets/style.css?v=${stats.v}">
<script>try{var l=localStorage.getItem('hkoc-lang');if(l)document.documentElement.dataset.lang=l;}catch(e){}</script>
</head>
<body data-page="${file.replace('.html', '')}" data-v="${stats.v}"${AI_ENDPOINT ? ` data-ai="${AI_ENDPOINT}"` : ''}>
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
<nav class="tabbar" aria-label="Main (mobile)">${tabs}</nav>
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
      <p>${t('聯絡', 'Contact')} <a href="mailto:liuxiangchen428@gmail.com">liuxiangchen428@gmail.com</a></p>
    </div>
  </div>
</footer>
<script src="assets/app.js?v=${stats.v}" defer></script>
</body>
</html>
`;
}
