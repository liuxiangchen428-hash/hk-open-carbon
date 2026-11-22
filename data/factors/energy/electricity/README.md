# 電力排放系數 / Electricity factors

| 系列 | 已錄入年份 | 來源 | 狀態 |
| --- | --- | --- | --- |
| 中電 CLP（`HK-CLP`） | 2021–2025 | `src-clp-esg-data-hub-2025` | reviewed |
| 中電 CLP（`HK-CLP`） | 2011–2015 | `src-clp-sr-2015`（PDF 第 137 頁，報告第 135 頁，圖表數據標籤） | draft |
| 中電 CLP（`HK-CLP`） | 2016–2020 | `src-clp-sr-2020`（PDF 第 147 頁） | reviewed |
| 中電 CLP（`HK-CLP`） | 2009、2010 | `src-clp-sr-2009-essence`、`src-clp-sr-2010-essence`（口徑為「每售出一度電，包括核電」） | reviewed |
| 港燈 HK Electric（`HK-HKE`） | 2020–2025 | `src-hke-sr-2022-statistics`（2020–21）、`src-hke-sr-2024-statistics`（2022–24）、`src-hke-sr-2025-statistics`（2025） | reviewed |
| 港燈 HK Electric（`HK-HKE`） | 2014–2019 | `src-hke-sr-2016-statistics` 至 `src-hke-sr-2020-statistics`（每年取最新一份列出該年的報告） | reviewed |
| 港燈 HK Electric（`HK-HKE`） | 2005 | `src-hke-sr-2020-statistics`（減排目標基準 0.93；取代 2010 年指引的 0.92） | draft |
| 中電、港燈 | 2002–2008 | 2010 年指引表 5 附註（`hk-guideline-2010/`；港燈 2005 年已取代） | reviewed |

## 待辦 / To do

- 中電 2011–2015 年：待維護者核對。
- 港燈 2009–2013 年：2014 年上市前的報告在港燈網站（擋 GitHub），未找到。港燈報告以 2005 年 0.93 kg/kWh 為減排基準（2020 年報告第 74 頁），與 2010 年指引的 0.92 不同；維護者決定（2026-11-22）採用 0.93（`hke-2005`），指引數值標為已取代。
- GWP（2026-11-22 查）：港燈 2025 年報告註明由 2025 年起採用 AR5（`hke-2025` 已改為 `AR5`），之前年份未註明。中電 2020 年報告的參考文件列有 IPCC 第五次評估報告，2022 年報告只寫「相關 IPCC 評估報告」，都沒有明確寫用哪一套 GWP，保持 `not-stated`。

## 錄入規則 / Rules

- 每年一個檔案，例如 `clp-2024.yaml`，id `hk.energy.electricity.clp.2024`。
- 數值照抄原文並記錄頁碼或表名，第一次讀數記錄在 `verification`。
- 中電用「售予本地客戶的全部電量，未扣除可再生能源證書」的口徑；港燈用「範圍 1+2 排放 ÷ 售電量」。
