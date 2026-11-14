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
| 2026-11-14 | 廢物暫時只保留紙張堆填一項；不用國際參考值，也不用全港總量相除推算 | 香港沒有公佈每噸廢物的本地系數 |
| 2026-11-14 | 交通系數允許推算（品質 D），但每個推算先列出算式給維護者同意；港鐵 COMET 圖未標單位，按克錄入並註明 | 香港營運商大多不公佈每乘客公里排放 |
| 2026-11-14 | 只錄入報告直接公佈的數值；需要推算的（品質 D）先列出給維護者決定，不先寫入 | 維護者刪除了煤氣 2021、2022 年的推算值 |
| 2026-11-14 | 允許數值為 0（原文公佈 0 時照錄）；新增 `unit_definition`；2010 年指引系數移到 `hk-guideline-2010/` 子資料夾；被新年份取代的舊系數加 `historical` 標籤；維護者偏好以近幾年數據為主 | 維護者審閱建議 |
| 2026-11-14 | 新增 `update_frequency`（指引常數設 `irregular`，不作過期提示）、`gwp_used`、AR2 選項、gCH4/gN2O 單位；同一來源的版權及 GWP 提示合併為一條 | 2010 年指引的系數是固定常數，用 AR2 GWP，CH4/N2O 以克計；逐個系數提示太多 |
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
- **數據**：電力 11 個（reviewed）；燃料及煤氣 33 個，全部 reviewed（2010 年指引 25 個；煤氣 2021–2025 年生產 5 個、燃燒 3 個）；另有 4 個 IPCC 預設值（reviewed）。交通 9 個（draft）：港鐵 2020–2024 每乘客公里 CO2、載通國際巴士每百萬車公里（2024–2025）及每程推算值（2024–2025），見 `data/factors/transport/README.md`（交通暫停，維護者決定先做其他）。廢物 1 個（紙張堆填 4.8，reviewed）；食水及污水 10 個（2017/18–2021/22，reviewed；2022/23 以後暫不推算），來自政府碳審計 Excel 範本存檔（carbon-footprint.hk 網域已易手，只用存檔）；香港沒有公佈每噸廢物的本地系數，見 `data/factors/waste/README.md`。各資料夾的 README 列出待辦。
- **讀取原文的經驗**：港燈官網擋 GitHub，會自動改用存檔；Internet Archive 回應頭很大，工作流程已設 `--max-http-header-size`。維護者也可以直接發 PDF 截圖，Claude 看圖算一次讀數（`method: pdf-visual`）。港交所 PDF 文件名只是編號，先用 `--pages 1-3` 確認公司和年份再錄入；公司自己的報告列表頁（例如 `src-towngas-esg-reports-page`）通常有直接連結。
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
3a. **頁碼同時寫 PDF 頁碼和報告印刷頁碼**，格式 `"34 (report p.67-68)"`；給維護者核對時也兩個都說。很多報告一頁 PDF 是兩頁跨頁。
3b. **不自行推算**：原文沒有直接公佈的數值不錄入；需要用兩個數字計算的，先問維護者。
4. 每完成一項就運行 `npm run validate` 和 `npm test`，提交並推送到 `main`；提交訊息結尾加上署名行。
5. 不要把第三方 PDF 或大段原文提交進倉庫；`.cache/` 已被 git 忽略。
6. 對外行動（寫信、公開倉庫、改倉庫設定、刪除東西）先問維護者。
7. 計劃有變時，更新本文件的決策記錄和進度，以及 claude.ai 上的計劃表。
