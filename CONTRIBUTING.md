# 參與貢獻 / Contributing

多謝你願意幫忙！Thank you for helping.

## 不會用 Git？/ Not using Git?

直接開 Issue，選擇對應表格就可以：報告數據錯誤、建議新系數、建議新來源、程式或網站問題、提案。維護者會幫你錄入。
Open an issue and pick a form; a maintainer will enter the data for you.

## 新增或修改系數 / Adding or changing a factor

1. **先登記來源**：在 `sources/registry.csv` 加一行（如來源未登記）。id 格式 `src-xxx`。
   Register the source first in `sources/registry.csv`.
2. **一個系數一個檔**：放在 `data/factors/<category>/` 下，`category` 必須是
   `schema/categories.yaml` 中的葉節點。One YAML file per factor.
3. **照抄原文**：數值必須與原始文件一致，並填 `source.page` 或 `source.table`。
   如需換算，在 `derivation` 寫出算式。Copy the value exactly; show any arithmetic in `derivation`.
4. **記錄你的讀數**：在 `verification` 加一項，寫明你是誰、怎樣讀到、日期和數值，見
   [methodology/verification.md](methodology/verification.md)。Record your reading in `verification`.
5. **新系數一律 `status: draft`**。Every new factor starts as `draft`.
6. 運行 `npm run validate` 和 `npm test`，全部通過後才提交 PR，並填寫 PR 模板中的檢查清單。

## 審核規則 / Review rules

本項目由一名維護者在 AI 助手協助下維護，完整規則見 [GOVERNANCE.md](GOVERNANCE.md)。
The project has one maintainer assisted by AI; full rules are in GOVERNANCE.md.

- 數值要獨立讀取兩次並一致，其中一次由維護者目視核對，才可改為 `status: reviewed`。
  A value becomes `reviewed` after two matching readings, one by the maintainer.
- 外部 PR 由維護者審閱後合併。External PRs are reviewed and merged by the maintainer.
- 數值更新不要覆蓋舊年份：新增一個新年份的檔案；舊系數若被取代，標記
  `status: deprecated` 及 `superseded_by`。Never overwrite past years; add a new file.

## 程式碼 / Code

- 所有校驗邏輯在 `scripts/lib/validate.mjs`，新規則請同時在 `test/` 加測試。
- Commit 訊息用簡短祈使句，例如 `Add CLP 2024 grid factor`。

## 行為準則 / Code of conduct

參與即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
