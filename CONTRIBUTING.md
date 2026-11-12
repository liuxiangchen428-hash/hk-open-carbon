# 參與貢獻 / Contributing

多謝你願意幫忙！Thank you for helping.

## 新增或修改系數 / Adding or changing a factor

1. **先登記來源**：在 `sources/registry.csv` 加一行（如來源未登記）。id 格式 `src-xxx`。
   Register the source first in `sources/registry.csv`.
2. **一個系數一個檔**：放在 `data/factors/<category>/` 下，`category` 必須是
   `schema/categories.yaml` 中的葉節點。One YAML file per factor.
3. **照抄原文**：數值必須與原始文件一致，並填 `source.page` 或 `source.table`。
   如需換算，在 `derivation` 寫出算式。Copy the value exactly; show any arithmetic in `derivation`.
4. **新系數一律 `status: draft`**。Every new factor starts as `draft`.
5. 運行 `npm run validate` 和 `npm test`，全部通過後才提交 PR。

## 審核規則 / Review rules

- 涉及 `data/` 的 PR 需最少一名數據審核員（DA）批准。
  PRs that touch `data/` need approval from at least one data reviewer.
- 審核員對照原始文件逐項核對後，可把 `status` 改為 `reviewed` 並填寫 `reviewed_by`。
  提交者不能審核自己的數據。Authors cannot review their own data.
- 數值更新不要覆蓋舊年份：新增一個新年份的檔案；舊系數若被取代，標記
  `status: deprecated` 及 `superseded_by`。Never overwrite past years; add a new file.

## 程式碼 / Code

- 所有校驗邏輯在 `scripts/lib/validate.mjs`，新規則請同時在 `test/` 加測試。
- Commit 訊息用簡短祈使句，例如 `Add CLP 2024 grid factor`。

## 行為準則 / Code of conduct

參與即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
