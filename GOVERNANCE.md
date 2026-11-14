# 治理規則 / Governance

本文件說明誰可以做甚麼決定、代碼和數據怎樣合併，以及怎樣成為維護者。
This document explains who decides what, how changes get merged, and how people take on roles.

## 1. 角色 / Roles

| 角色 Role | 職責 Responsibilities | 權限 Permissions |
| --- | --- | --- |
| **貢獻者** Contributor | 提交 Issue、PR、數據或文件 | 任何人都可以 |
| **數據審核員** Data reviewer (DA) | 對照原始文件核對系數，把 `status` 改為 `reviewed` | 可批准涉及 `data/`、`sources/`、`methodology/` 的 PR |
| **維護者** Maintainer | 審核代碼、合併 PR、發佈版本、管理 Issue | 倉庫寫入權限 |
| **項目負責人** Project lead | 對外代表項目；在無法達成共識時作最後決定 | 倉庫管理權限 |
| **顧問** Advisor | 就方法學和數據質素提供意見 | 沒有合併權限；意見記錄在 Issue 或評審記錄中 |

一人可以兼任多個角色，但**不能審核自己提交的數據**。
One person may hold several roles, but nobody reviews their own data.

現任名單見 [MAINTAINERS.md](MAINTAINERS.md)。

## 2. 怎樣做決定 / How decisions are made

大部分決定採用**默許共識**（lazy consensus）：在 Issue 或 PR 提出建議，沒有人反對就可以執行。

| 事項 | 做法 | 最短公示期 |
| --- | --- | --- |
| 修正錯字、文件、小型代碼改動 | 一名維護者批准即可合併 | 無 |
| 新增或修改系數 | 一名數據審核員批准（見第 3 節） | 無 |
| 新功能、改動計算方法 | 開 Issue 討論，一名維護者及一名數據審核員批准 | 3 天 |
| **數據格式（schema）、分類、單位、質素等級的改動** | 以「提案」Issue 提出，說明原因及對現有數據的影響 | 7 天 |
| 授權、本治理文件、項目範圍的改動 | 提案 Issue，須項目負責人同意 | 14 天 |

有人反對時，先在 Issue 內討論。仍無法達成共識的，由維護者投票（簡單多數）；票數相同或只有一名維護者時，由項目負責人決定，並在 Issue 中寫明理由。

## 3. 合併規則 / Merge rules

- 所有 PR 必須通過自動檢查（`validate` 工作流程）。
- **涉及 `data/` 或 `sources/registry.csv` 的 PR**：最少一名數據審核員批准，且批准人不是提交者。
- **其他 PR**：最少一名維護者批准，且批准人不是提交者。
- 系數改為 `status: reviewed` 時，必須填寫 `reviewed_by`，並在 PR 中說明核對了哪份文件的哪一頁。
- 舊年份數據不得直接覆蓋；被取代的系數標記 `status: deprecated` 及 `superseded_by`。
- 自動化流程（例如每月更新存檔連結的 `archive-sources`）可直接提交，只限修改 `archive_url`、`archived_on` 兩欄。

### 過渡安排 / Transitional rule

在維護者少於兩人期間，項目負責人可以在自動檢查通過後合併自己的 PR，但：

- 新系數只能保持 `status: draft`，不得自行改為 `reviewed`；
- 第 2 節中需要公示期的事項，仍須公示後才合併。

有第二位維護者或數據審核員加入後，此過渡安排自動失效。

## 4. 成為審核員或維護者 / Becoming a reviewer or maintainer

- **數據審核員**：有碳核算、生命周期評估或相關專業背景，並曾提交最少 5 個被接納的數據 PR（或由顧問推薦）。由一名現任維護者提名，公示 7 天無反對即生效。
- **維護者**：持續貢獻最少 3 個月、熟悉代碼和流程。由現任維護者提名，公示 7 天無反對即生效。
- 連續 6 個月沒有參與的審核員或維護者，會轉為「榮譽」名單，可隨時申請恢復。

## 5. 利益衝突 / Conflicts of interest

顧問公司、ESG 軟件公司、公用事業公司或其他機構的人士都歡迎參與，但：

- 審核或提交與自己機構有關的數據（例如自己公司的排放系數）時，必須在 PR 中聲明；
- 有利益衝突的人不能批准該 PR，須由另一名審核員批准。

## 6. 發佈 / Releases

- 版本號採用語義化版本：數據格式有不兼容改動時升主版本號，新增數據或功能升次版本號，修正錯誤升修訂號。
- 每個正式版本發佈前，最少一名數據審核員確認本次新增的 `reviewed` 系數。
- 正式版本在 Zenodo 取得 DOI，方便引用。

## 7. 對外溝通 / Communication

- 公開討論：GitHub Issues 和 Discussions。
- 行為問題舉報：見 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
- 安全問題或私人事宜：聯絡項目負責人（聯絡方式見 MAINTAINERS.md）。

## 8. 修改本文件 / Changing this document

本文件的修改按第 2 節「治理文件改動」處理：提案 Issue、公示 14 天、項目負責人同意。
