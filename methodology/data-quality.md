# 數據質素等級 / Data quality levels

每個系數的 `quality` 欄位表示其來源的可靠程度。Each factor's `quality` field rates its source.

| 等級 | 來源類型 | 例子 |
| --- | --- | --- |
| A | 香港政府官方公佈 | 環保署排放清單、機電署與環保署建築物指引 |
| B | 香港公用事業、企業或機構公佈 | 中電、港燈、煤氣、港鐵可持續發展報告 |
| C | 國際權威預設值或同行評審文獻 | IPCC 指南預設值、學術期刊 |
| D | 本項目推算或估算 | 由多個來源組合計算的數值（必須填 `derivation`） |

## 使用原則 / How to choose

1. 同一用途有多個系數時，優先使用等級較高、年份較近、地區較貼近（`HK-CLP` / `HK-HKE` 優於 `HK` 優於 `GLOBAL`）的系數。
2. D 級系數必須在 `derivation` 列出完整算式及所用的其他系數 id。
3. 等級描述的是**來源類型**，不代表數值一定準確；審核狀態見 `status`。

## 審核狀態 / Review status

| status | 含義 |
| --- | --- |
| `draft` | 已錄入，未經第二人核對 |
| `reviewed` | 已由另一位審核員對照原始文件核對（須填 `reviewed_by`） |
| `deprecated` | 已被取代（須填 `superseded_by`） |

## 過時提示 / Staleness

本地系數（region 不是 `GLOBAL`）的年份若比當年早超過 2 年，校驗會發出警告（不會阻止合併），提醒更新或標記為 `deprecated`。
