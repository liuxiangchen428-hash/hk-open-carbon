# 電力排放系數 / Electricity factors

| 系列 | 已錄入年份 | 來源 | 狀態 |
| --- | --- | --- | --- |
| 中電 CLP（`HK-CLP`） | 2021–2025 | `src-clp-esg-data-hub-2025` | draft，待維護者第二次讀數 |
| 港燈 HK Electric（`HK-HKE`） | 2022–2024 | `src-hke-sr-2024-statistics` | draft，待維護者第二次讀數 |

## 待辦 / To do

- 港燈 2025 年：SR2025 報告無法經 GitHub Actions 下載（官網及存檔都失敗），需維護者手動打開 PDF 查看。
- 2005–2020 年：需要舊年度報告（中電、港燈各自的可持續發展報告），先登記來源再錄入。
- 兩家公司的 GWP 版本：原文未註明，查各自的溫室氣體核算方法文件後補上 `gwp`。

## 錄入規則 / Rules

- 每年一個檔案，例如 `clp-2024.yaml`，id `hk.energy.electricity.clp.2024`。
- 數值照抄原文並記錄頁碼或表名，第一次讀數記錄在 `verification`。
- 中電用「售予本地客戶的全部電量，未扣除可再生能源證書」的口徑；港燈用「範圍 1+2 排放 ÷ 售電量」。
