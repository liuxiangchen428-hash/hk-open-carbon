# 數值核對（兩次錄入）/ Verification (double entry)

本項目由一名維護者在 AI 助手（Claude）協助下維護。為了在沒有第二位人手審核員的情況下保證數值準確，每個系數的數值都要**獨立讀取兩次**，並由校驗程式自動比對。
This project is maintained by one person with help from an AI assistant. To keep values accurate without a second human reviewer, each value is read twice, independently, and the validator compares the readings.

## 怎樣記錄 / How it is recorded

```yaml
value: 0.38
verification:
  - by: claude            # 從原始文件抽取的文字讀取 / read from extracted text
    method: text-extract
    date: 2026-11-14
    value: 0.38
    page: 12
  - by: maintainer        # 維護者打開 PDF 該頁目視核對 / maintainer looked at the PDF page
    method: pdf-visual
    date: 2026-11-15
    value: 0.38
    page: 12
```

| 欄位 | 值 |
| --- | --- |
| `by` | `maintainer`（項目負責人）、`claude`（AI 助手）、`contributor:<GitHub 帳號>`（其他人） |
| `method` | `pdf-visual`（看原文頁面）、`text-extract`（讀抽取出的文字）、`recalculation`（用其他公開數字重新計算） |
| `value` | 這次讀到的數值，原樣記錄，不要先「修正」 |

## 規則（校驗程式會檢查）/ Rules (enforced)

1. **任何一次讀數與 `value` 不同，都會報錯。** 須回到原文查清楚，不可直接改讀數遷就。
2. **`status: reviewed` 須有最少兩次讀數**，兩次的 `by` 或 `method` 不同，其中最少一次由維護者進行。
3. 未滿足以上條件的系數保持 `status: draft`。草稿數據可以使用，但網站會清楚標示。

## 工作流程 / Workflow

1. Claude 用 `node scripts/fetch-source.mjs <來源 id> --pages <頁碼>` 取得原文文字，錄入系數並加入第一次讀數（`by: claude, method: text-extract`）。
2. 維護者打開原始文件（或 Internet Archive 存檔）的同一頁，看清數值，加入第二次讀數（`by: maintainer, method: pdf-visual`）。
3. 兩次一致、來源連結已確認（`url_status: found`），即可改為 `status: reviewed`。

## 限制 / Limitations

- Claude 是 AI，不是獨立的專業審核員，可能讀錯表格欄位或單位。維護者的目視核對是最後把關。
- 這套做法降低抄錄錯誤，但不能保證來源本身正確；來源質素見 [data-quality.md](data-quality.md)。
