# 來源登記 / Source registry

`registry.csv` 列出本項目使用或計劃使用的所有來源。每個系數的 `source.id` 必須在這裏登記。
Every factor's `source.id` must be registered in `registry.csv`.

## 欄位 / Columns

| 欄位 | 說明 |
| --- | --- |
| `id` | `src-` 開頭，小寫英文、數字及連字號 |
| `title` / `title_zh` | 英文及中文名稱 |
| `publisher` | 出版機構 |
| `edition` | 版本或年份，例如「2024 inventory, released 2026-01-22」 |
| `type` | inventory, statistics, guideline, standard, policy, company-report, open-dataset, reference-table, journal-article, tool, terms, directory, methodology |
| `url` | 連結。能直達文件就不要用首頁 |
| `url_status` | 見下表 |
| `reuse` | 見下表 |
| `terms_url` | 適用的使用條款頁面 |
| `used_for` | 用途，例如 `factors:electricity`、`inventory`、`org-toolkit` |
| `checked_on` | 最後核對日期 YYYY-MM-DD |
| `notes` | 數據在文件哪裏、要注意甚麼 |
| `archive_url` | Internet Archive 存檔連結（自動填寫，見下文） |
| `archived_on` | 存檔日期 YYYY-MM-DD |

### `url_status`

| 值 | 含義 |
| --- | --- |
| `found` | 連結在搜尋結果中出現，標題與文件吻合 |
| `inferred` | 按同一網站其他已確認連結的格式推斷，未直接見到 |
| `homepage` | 只有機構首頁，具體文件待找 |
| `to-check` | 連結未經確認 |

**注意：** 2026-11-12 首次整理時，項目環境無法直接打開這些網站，`found` 表示經搜尋引擎確認存在，並未下載核對內容。錄入數值前，必須打開原文並記錄頁碼或表號。只有 `found` 的來源可以支持 `status: reviewed` 的系數（校驗會檢查）。

### `reuse`（再使用條款）

| 值 | 含義 | 對本項目的影響 |
| --- | --- | --- |
| `open-attribution` | 可作商業及非商業用途，註明出處即可（例如 DATA.GOV.HK） | 可直接使用 |
| `noncommercial-or-permission` | 只限非商業用途，商業用途需書面許可（不少政府部門網站） | 見下文 |
| `quote-with-attribution` | 企業報告，引用數值並註明出處 | 一般可以 |
| `reference-only` | 標準或手冊，只參考方法，不抄錄內容 | 不收錄原文 |
| `check` | 條款未確認 | 錄入前要查 |
| `n/a` | 條款頁本身 | — |

## 授權問題：要先處理 / Licensing issue to resolve

本項目數據以 **CC BY 4.0** 發佈，容許他人作商業用途。但環保署、機電署等部門網站的版權告示寫明，商業用途要事先取得書面許可。DATA.GOV.HK 則容許商業及非商業用途，只需註明出處。

本項目自身屬非牟利用途，但 CC BY 4.0 容許他人（例如替客戶做 ESG 報告的顧問公司）作商業用途，所以仍要留意。做法：

1. **只錄入數值並註明出處**，不複製原文段落、圖表或整份表格，不把第三方 PDF 放進倉庫。單一數值屬事實，一般不受版權保護。
2. **同一份數據優先用 DATA.GOV.HK 的版本**，例如機電署《香港能源最終用途數據》。
3. **建議**在倉庫公開或 v0.1 發佈前，去信環保署、機電署及環境及生態局，說明這是非牟利開源項目並請求確認。這不是硬性要求，但成本低，也有助日後合作。
4. 校驗會對使用這些來源的系數發出提示（警告，不會阻止提交）。

以上是一般性判斷，不構成法律意見。

## 存檔 / Archiving

原始連結可能失效，所以每個來源都在 Internet Archive（Wayback Machine）保留一份存檔。本倉庫不放第三方 PDF，只記錄存檔連結。

存檔由 GitHub Actions 自動完成（`.github/workflows/archive-sources.yml`）：

- **每月 1 日**自動運行：查詢每個來源的最新存檔；沒有存檔或存檔超過一年的，請求 Internet Archive 重新存檔。
- **手動運行**：GitHub 倉庫 → Actions → archive-sources → Run workflow。
- 結果會自動寫入 `archive_url`、`archived_on` 並提交。

本機亦可運行（需要能連上 archive.org）：

```bash
node scripts/archive-sources.mjs            # 只查詢現有存檔
node scripts/archive-sources.mjs --save     # 沒有存檔的就請求存檔
```

部分網站（例如需要登入或阻擋爬蟲的頁面）可能無法存檔，結果會顯示 `missing`，需人手處理。

## 待辦 / To do

- [x] 2024 年溫室氣體清單數據表（`src-eeb-ghg-data-tables-2024`，經存檔讀取，2026-11-22）
- [x] 2010 年建築物指引的 PDF 直接連結及頁碼（`src-emsd-epd-building-ghg-2010`）
- [x] 水務署每立方米食水耗電量：改用政府碳審計範本的食水系數（`src-carbon-audit-excel-template`），2022/23 以後按維護者決定暫不推算
- [x] 渠務署最新報告：2024-25 年度 ESG 報告（`src-dsd-esg-2024-25`，2026-11-22 登記）
- [x] 煤氣系數頁碼（2021–2025 年報告，見 `data/factors/energy/town-gas/`）
- [x] 九巴：改用載通國際在港交所的年報（`src-tih-ar-2025`、`src-tih-ar-2025-full`）
- [x] 運輸署《運輸資料年報》：2022–2024 年版仍有出版（2026-11-22 查）
- [ ] 未有存檔、需人手處理的來源：Poore & Nemecek 論文；2026-11-22 再次請求存檔的有 `src-datagovhk-ghg-by-sector`、`src-tih-ar-2025-full`、`src-ipcc-2006-v2-ch1`、`src-hke-sr-2016-statistics`、`src-clp-sr-2015`（中電網站擋 GitHub，可能存不到）
- [x] 確認再使用條款（2026-11-22 讀原文，條款頁登記為 `src-terms-*`）：
  - 英國政府系數：開放政府授權 v3.0，可商業使用，須註明出處 → `open-attribution`
  - IPCC 指南（4 個來源）：只限個人非商業用途，其他用途須 IPCC 秘書處書面許可 → `noncommercial-or-permission`（4 個 IPCC 預設燃料系數在用）
  - 溫室氣體議定書 GWP 表：網站條款禁止公開或商業用途 → `noncommercial-or-permission`（未使用）
  - 建造業議會碳評估工具：只限個人或非商業內部用途 → `noncommercial-or-permission`（未使用）
  - Poore & Nemecek：沒有開放授權，版權屬作者並獨家授權 AAAS → `reference-only`（只作參考，不抄數值）
- [ ] 4 個 IPCC 預設燃料系數：保留、去信 IPCC 請求許可，或刪除（需要維護者決定）
- [ ] （建議）公開前去信相關部門請求確認（需要維護者）
