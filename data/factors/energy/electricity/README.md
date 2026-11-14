# 電力排放系數 / Electricity factors

| 系列 | 已錄入年份 | 來源 | 狀態 |
| --- | --- | --- | --- |
| 中電 CLP（`HK-CLP`） | 2021–2025 | `src-clp-esg-data-hub-2025` | reviewed |
| 港燈 HK Electric（`HK-HKE`） | 2020–2025 | `src-hke-sr-2022-statistics`（2020–21）、`src-hke-sr-2024-statistics`（2022–24）、`src-hke-sr-2025-statistics`（2025） | reviewed |

## 待辦 / To do

- 中電 2005–2020 年、港燈 2005–2019 年：需要舊年度報告（中電、港燈各自的可持續發展報告），先登記來源再錄入。
- 兩家公司的 GWP 版本：原文未註明，查各自的溫室氣體核算方法文件後補上 `gwp`。

## 錄入規則 / Rules

- 每年一個檔案，例如 `clp-2024.yaml`，id `hk.energy.electricity.clp.2024`。
- 數值照抄原文並記錄頁碼或表名，第一次讀數記錄在 `verification`。
- 中電用「售予本地客戶的全部電量，未扣除可再生能源證書」的口徑；港燈用「範圍 1+2 排放 ÷ 售電量」。
