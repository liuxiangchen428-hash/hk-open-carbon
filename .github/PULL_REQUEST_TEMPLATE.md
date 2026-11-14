## 改動內容 / What this changes

<!-- 一兩句說明。相關 Issue：#編號 / One or two sentences. Related issue: #number -->

## 類型 / Type

- [ ] 數據：新增或修改系數 / Data: add or change factors
- [ ] 來源登記 / Source registry
- [ ] 程式碼 / Code
- [ ] 文件 / Docs
- [ ] 提案（數據格式、授權、治理）/ Proposal (schema, license, governance) — 公示期 / notice period:

## 數據檢查（涉及 `data/` 或 `sources/` 時必填）/ Data checklist

- [ ] 每個系數的數值已對照原始文件，並填寫 `source.page` 或 `source.table` / Values checked against the source, page or table recorded
- [ ] 來源已在 `sources/registry.csv` 登記 / Source is registered
- [ ] 已在 `verification` 記錄讀數 / Readings recorded in `verification`
- [ ] 新系數為 `status: draft` / New factors are `draft`
- [ ] 沒有覆蓋舊年份數據 / No past-year data overwritten
- [ ] 如有換算，已在 `derivation` 寫出算式 / Any conversion is shown in `derivation`

**核對了哪份文件的哪一頁 / Document and pages checked:**

## 測試 / Tests

- [ ] `npm run validate` 通過 / passes
- [ ] `npm test` 通過 / passes

## 利益衝突 / Conflict of interest

- [ ] 本 PR 涉及我任職或代表的機構的數據（如是，這些讀數不計入審核所需的兩次讀數）/ This PR involves data from an organisation I work for or represent
