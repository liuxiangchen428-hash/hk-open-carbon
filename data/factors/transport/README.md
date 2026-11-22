# 交通排放系數 / Transport factors

香港大部分交通營運商不直接公佈「每乘客公里排放」。本資料夾只收錄報告直接公佈的數值；推算值（品質 D）須維護者同意，並寫明算式。
Most Hong Kong operators do not publish emissions per passenger-km. Only published values are entered; derived values (quality D) need the maintainer's approval and show their arithmetic.

| 系列 | 年份 | 單位 | 來源 | 類型 |
| --- | --- | --- | --- | --- |
| `rail/mtr-co2-per-pkm` | 2020–2024 | g CO2 / 乘客公里 | 港鐵 2025 表現指標第 42 頁（COMET 對比圖） | 公佈值；原圖未標單位，按數量級判斷為克（維護者同意） |
| `bus/tih-per-vkm` | 2024–2025 | t CO2e / 百萬車公里 | 載通國際 2025 年報第 88 頁 | 公佈值；車輛排放，不是每位乘客 |
| `bus/tih-per-trip` | 2024–2025 | kg CO2e / 程 | 同上，第 88、114–115 頁 | 推算值（D）：巴士總排放 ÷ 九巴加龍運乘客人次 |

## 待辦 / To do

- 城巴、小巴、電車、渡輪：未找到營運商公佈的排放數據。
- 的士、私家車：沒有營運商數據；如要做需用燃料系數加假設耗油量，須維護者決定。
- 港鐵 2025 年：等 2026 年報告的 COMET 數據。
- 計算器已接上港鐵（每乘客公里）及巴士（每程）系列；系數改為 reviewed 後才會計入。私家車用 2010 年指引的汽油／柴油流動源 CO2 系數（已審核），未計 CH4、N2O。
