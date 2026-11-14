# 治理規則 / Governance

本項目由**一名維護者**在 **AI 助手（Claude）** 協助下維護。本文件說明誰做決定、改動怎樣合併、數據怎樣算「已審核」，以及日後有人加入時怎樣處理。
This project is run by one maintainer with help from an AI assistant (Claude). This document explains who decides, how changes are merged, what "reviewed" means, and how others can join later.

## 1. 角色 / Roles

| 角色 Role | 誰 Who | 職責 Responsibilities |
| --- | --- | --- |
| **維護者**（項目負責人）Maintainer | 見 [MAINTAINERS.md](MAINTAINERS.md) | 所有決定；對外聯絡；目視核對數值；合併及發佈 |
| **AI 助手** AI assistant | Claude | 寫代碼和文件；研究來源；從原文抽取數值；起草文稿。不能代替維護者做決定，也不能單獨把數據標為已審核 |
| **貢獻者** Contributor | 任何人 | 提交 Issue、PR、數據或文件 |
| **顧問**（可選）Advisor | 受邀人士 | 就方法學提供意見，沒有合併權限 |

### AI 助手的限制 / Limits of the AI assistant

- Claude 沒有自己的 GitHub 帳號；它的提交以「Claude」署名，經維護者授權的工作階段推送。
- Claude 不會記得之前的對話，項目背景和決策記錄寫在 [CLAUDE.md](CLAUDE.md)，每次工作前先讀。
- Claude 可能讀錯表格或單位，所以數值必須經維護者目視核對才算已審核（第 3 節）。

## 2. 怎樣做決定 / How decisions are made

維護者作所有決定。為了讓用戶和日後的參與者看得到原因：

| 事項 | 做法 |
| --- | --- |
| 修正錯字、文件、代碼 | 直接改，自動檢查通過即可 |
| 新增或修改系數 | 按第 3 節核對 |
| 數據格式（schema）、分類、單位、質素等級 | 在 CLAUDE.md 的決策記錄寫明原因；倉庫公開後，另開「提案」Issue 公示 **7 天**才合併 |
| 授權、本治理文件、項目範圍 | 同上，公開後公示 **14 天** |

公示期內有人提出反對，維護者須在 Issue 中回應並寫明最後決定的理由。

## 3. 數據審核 / Data review

- 所有改動必須通過自動檢查（`validate` 工作流程）。
- 每個系數的數值要**獨立讀取兩次**並記錄在 `verification` 欄位，校驗程式會自動比對，詳見 [methodology/verification.md](methodology/verification.md)。
- **`status: reviewed` 的條件**：兩次讀數一致、讀取人或方法不同、其中一次由維護者進行，而且來源連結已確認（`url_status: found`）。
- 未達條件的系數保持 `status: draft`；網站會清楚標示草稿數據。
- 舊年份數據不得覆蓋；被取代的系數標記 `status: deprecated` 及 `superseded_by`。

## 4. 誰可以推送 / Who may push

| 改動 | 方式 |
| --- | --- |
| 維護者的改動 | 可直接推送到 `main` |
| Claude 的代碼、文件、草稿數據 | 在維護者開啟的工作階段內直接推送到 `main`，提交訊息須說明改動 |
| 把系數改為 `reviewed` | 只在維護者的讀數已記錄後進行 |
| 自動流程（`archive-sources`） | 可直接提交，只限修改 `archive_url`、`archived_on` 兩欄 |
| 外部貢獻者 | 開 PR，由維護者（可請 Claude 協助）審閱後合併；貢獻者的讀數可記錄為 `by: contributor:<帳號>` |

## 5. 利益衝突 / Conflicts of interest

提交或核對與自己任職、代表的機構有關的數據時，必須在 Issue 或 PR 中聲明。這類讀數不能作為 `reviewed` 所需的其中一次讀數。

## 6. 日後有人加入 / If others join

- 有碳核算或相關背景、願意協助核對的人，可由維護者邀請成為**數據審核員**，其讀數可代替維護者的讀數。
- 有第二位長期參與的維護者時，應重新檢視本文件，例如加入「不得審核自己提交的數據」等雙人規則。

## 7. 發佈 / Releases

- 版本號採用語義化版本：數據格式不兼容改動升主版本號，新增數據或功能升次版本號，修正錯誤升修訂號。
- 每次發佈列出本版新增及改為 `reviewed` 的系數。
- 正式版本在 Zenodo 取得 DOI。

## 8. 透明度 / Transparency

README 和網站須說明本項目由一人維護、AI 協助，以及數據怎樣核對，讓用戶自行判斷可信程度。

## 9. 修改本文件 / Changing this document

按第 2 節「授權、治理文件」處理。
