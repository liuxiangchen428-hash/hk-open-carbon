# CLAUDE.md — 項目背景與工作規則

Claude 每次開始工作前先讀這份文件。它記錄項目背景、已作決定、目前進度和工作方式。有新決定或進度時，在相應段落更新。

## 項目 / Project

- **名稱**：香港開源碳核算平台 · HK Open Carbon Platform（英文名暫定）
- **倉庫**：github.com/liuxiangchen428-hash/hk-open-carbon（目前私有）
- **定位**：開源、免費、可溯源的香港本地碳排放系數庫及核算工具，服務市民、企業及政府。只做香港。
- **團隊**：一名維護者（項目負責人，GitHub: liuxiangchen428-hash）+ Claude。預計長期如此。
- **搭建計劃表**：claude.ai 上的文件「香港开源碳核算平台：搭建计划表」https://claude.ai/artifact/5xNnWvk1dAkQ1TBMwYMEeG （第 1 週由 2026-11-16 起算）。改動計劃時同步更新該文件的變更記錄。
- **溝通語言**：維護者用簡體中文溝通；倉庫內面向公眾的文件用繁體中文加英文。

## 決策記錄 / Decision log

最新的在最上面。

| 日期 | 決定 | 原因 |
| --- | --- | --- |
| 2026-11-14 | `gwp` 增加 `not-stated` 選項（校驗會提示）；過期提示只看每個系列最新一年 | 中電、港燈原文未註明 GWP；歷史年份應保留，不應逐年提示 |
| 2026-11-14 | 電力系數口徑：中電用未扣除 REC 的售電排放強度；港燈用範圍 1+2 ÷ 售電量 | 兩家公司公佈的標準口徑，亦是港交所指引引用的數字 |
| 2026-11-14 | 團隊只有維護者和 Claude；治理改為「一人維護 + AI 協助」，數值須兩次獨立讀取並一致、其中一次由維護者核對才算 reviewed | 沒有第二位人手審核員 |
| 2026-11-14 | 用 GitHub Actions（fetch-sources）讀取原始文件：Actions 下載並把文字印到日誌，本地讀取後刪除日誌 | 工作環境不能直接上網，也不能下載 Actions artifact |
| 2026-11-12 | 原始文件只記錄 Internet Archive 存檔連結，不把 PDF 放進倉庫；每月自動更新 | 避免轉載第三方文件的版權問題 |
| 2026-11-12 | 保持數據 CC BY 4.0（不改 NC）；只錄入數值並註明出處；公開前建議去信政府部門確認（非硬性） | 企業用戶做 ESG 報告屬商業用途，NC 會擋住主要用戶 |
| 2026-11-12 | 代碼 Apache-2.0，數據 CC BY 4.0；不收錄 ecoinvent 等商業數據庫 | 開源、免費 |
| 2026-11-12 | 數據以 YAML 檔放在 Git，一個系數一個檔；靜態網站，計算在瀏覽器完成 | 零伺服器成本、可追溯、無私隱問題 |

## 目前進度 / Status

- **階段**：第 0 階段（項目準備）。
- **已完成**：授權；來源登記 43 個（含再使用條款）；Internet Archive 存檔（41/43）；治理文件；Issue 表單、PR 模板、CODEOWNERS；fetch-sources 讀取流程；兩次錄入核對。
- **數據**：4 個 IPCC 燃料預設值（draft）；電力系數 11 個，全部 reviewed（中電 2021–2025、港燈 2020–2025）。更早年份未錄入，見 `data/factors/energy/electricity/README.md`。
- **讀取原文的經驗**：港燈官網擋 GitHub，會自動改用存檔；Internet Archive 回應頭很大，工作流程已設 `--max-http-header-size`。維護者也可以直接發 PDF 截圖，Claude 看圖算一次讀數（`method: pdf-visual`）。
- **待維護者決定**：英文名、公開聯絡郵箱、何時公開倉庫、是否邀請顧問。
- **已知待辦**：見 `sources/README.md` 的待辦清單。

## 常用指令 / Commands

```bash
npm ci                     # 安裝依賴
npm run validate           # 校驗所有數據
npm test                   # 測試
npm run build              # 生成 dist/
node scripts/fetch-source.mjs <src-id> [--pages 10-25] [--archive]
                           # 經 GitHub Actions 取得原始文件文字，存到 .cache/sources/
```

GitHub 只能用 REST API（`gh api ...`），GraphQL 在此環境不可用，所以 `gh workflow run`、`gh pr create` 等指令會失敗。

## 工作規則 / Working rules

1. **數值必須來自原文**：用 `fetch-source.mjs` 取得原文，記錄頁碼或表號，不要用搜尋摘要或記憶中的數字。
2. **錄入時加第一次讀數**：`verification` 加 `{ by: claude, method: text-extract, date, value, page }`，`status` 保持 `draft`。不可替維護者加 `by: maintainer` 的讀數。
3. **新來源先登記** `sources/registry.csv`，再錄入系數。
4. 每完成一項就運行 `npm run validate` 和 `npm test`，提交並推送到 `main`；提交訊息結尾加上署名行。
5. 不要把第三方 PDF 或大段原文提交進倉庫；`.cache/` 已被 git 忽略。
6. 對外行動（寫信、公開倉庫、改倉庫設定、刪除東西）先問維護者。
7. 計劃有變時，更新本文件的決策記錄和進度，以及 claude.ai 上的計劃表。
