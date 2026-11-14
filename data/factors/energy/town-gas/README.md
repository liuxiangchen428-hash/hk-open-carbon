# 煤氣排放系數 / Towngas factors

煤氣 1 單位 = 48 兆焦耳（MJ）熱值，以煤氣錶讀數計（2010 年指引第 37 頁）。所有以「單位」計的煤氣系數都在 `unit_definition` 欄記錄這個定義。
One towngas unit = 48 MJ (recorded in `unit_definition` on every per-unit factor).

| 系列 | 年份 | 來源 | 用途 | 狀態 |
| --- | --- | --- | --- | --- |
| `hk-guideline-2010/purchased-<年>` | 2005–2008 | 2010 年指引表 6（第 37 頁） | 歷史數據（標籤 `historical`），只用於核算當年排放 | reviewed |
| `purchased.<年>` | 2021–2023、2025 | 煤氣 2021、2022、2023、2025 ESG 報告 | 購買煤氣的間接排放（煤氣生產過程，範圍 2） | reviewed |
| `purchased.<年>` | 2024 | 煤氣 2024 ESG 報告第 106 頁 | 購買煤氣的間接排放（煤氣生產過程，範圍 2） | reviewed |
| `combustion-co2e.<年>` | 2023、2025 | 煤氣 2023、2025 ESG 報告 | 用戶端燃燒（範圍 1） | reviewed |
| `combustion-co2e.<年>` | 2024 | 煤氣 2024 ESG 報告第 106 頁 | 用戶端燃燒（範圍 1） | reviewed |
| `hk-guideline-2010/combustion-<氣體>-emsd2010` | — | 2010 年指引表 1-1 至 1-3（第 28 頁） | 燃燒的 CO2、CH4、N2O 分項系數（範圍 1） | reviewed |

核算時：用戶燃燒煤氣的排放（範圍 1）加上購買煤氣的生產排放（範圍 2）。2024 年合計每單位 3.101 kg CO2e。

待辦：
- 2021、2022 年報告沒有直接公佈每單位用戶端燃燒排放，按維護者決定暫不錄入（不用推算值）。
