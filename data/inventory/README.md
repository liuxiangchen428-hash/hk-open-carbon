# 全港溫室氣體排放清單 · Hong Kong GHG inventory

`hk-ghg.csv` 一行一年（1990 年起），欄位說明、單位、來源頁碼及核對紀錄在 `hk-ghg.yaml`。
數值照錄政府公佈的數據表（三個有效數字），本平台不作任何計算。網站「排放清單」頁的 2035 目標線（2005 年 × 0.5）在瀏覽器顯示時計算，並註明是本平台按公佈數字計算。

One row per year from 1990. Column meanings, units, source pages and checks are in `hk-ghg.yaml`. Values are copied as published (three significant figures); nothing is computed here.

| 欄位 column | 單位 unit | 來源 source |
| --- | --- | --- |
| electricity, transport, other_fuel, waste, ippu, afolu, total | ktCO2e | `src-eeb-ghg-data-tables-2024`, PDF p.1–2 |
| per_capita | tCO2e | `src-eeb-ghg-data-tables-2024-percapita`, PDF p.1 |
| intensity | kgCO2e per HK$ GDP (chained 2023 dollars) | 同上 same |

- GWP：AR5。2023 年以前發布的舊版清單用 AR4，不要混用。
- 校驗（`scripts/lib/inventory.mjs`）：年份連續；數字不帶千位分隔號；六個分項相加與總數的差距不超過四捨五入的容許範圍（可抓錄入錯字）。
- 狀態：`reviewed`（2026-11-22 維護者核對）。

## 待辦 / To do

- [x] 維護者核對 2024 年數據表（2026-11-22）。
- [ ] 政府每年約 1 月公佈新一年數字；新表通常會回溯修訂往年，更新時整個 CSV 一起替換。
