# AI 助手 / AI assistant

網站右下角「AI 助手」的後端：一個 Cloudflare Worker，用 Workers AI 上的開源模型回答。
The backend of the website's "Ask AI" button: a Cloudflare Worker that answers with an open model on Workers AI.

## 怎樣運作 / How it works

1. 網頁把問題送到 `POST /chat`。The page sends the question to `POST /chat`.
2. Worker 讀取網站公開的 `assets/data.json`（快取一小時），按問題挑出最相關的已審核系數（最多 28 個），連同全港排放清單摘要放進提示。
   The Worker reads the site's public `assets/data.json` (cached for an hour), picks the most relevant reviewed factors (up to 28) and adds a short inventory summary to the prompt.
3. 模型只可按這些數據回答，引用系數編號（例如 `[hk.energy.electricity.clp.2025]`），網頁把編號變成連結。
   The model must answer from that data and cite factor ids, which the page turns into links.

- 模型按 `wrangler.toml` 的 `MODELS` 順序嘗試，第一個失敗就用下一個。Models in `MODELS` are tried in order.
- 只接受 `ALLOWED_ORIGINS` 的網頁；每個 IP 每分鐘最多 `PER_MINUTE` 個問題。Only `ALLOWED_ORIGINS` may call it; `PER_MINUTE` questions per IP per minute.
- 不記錄問題內容。Questions are not logged.
- 免費方案用完每日額度後會回覆「今日額度已用完」，不會產生費用。On the free plan, once the daily allowance is used the assistant says so; no charges arise.

## 部署 / Deploy

GitHub Actions `deploy-worker` 在 `worker/` 有改動時自動部署，需要兩個倉庫 secrets：
The `deploy-worker` workflow deploys on changes to `worker/` and needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

部署後把 Worker 網址填入 `site/src/config.mjs` 的 `AI_ENDPOINT`，網站就會顯示「AI 助手」按鈕。
After deploying, put the Worker URL in `AI_ENDPOINT` in `site/src/config.mjs` to show the button.

## 測試 / Test

```bash
node --test test/worker.test.mjs
```
