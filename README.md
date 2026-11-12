# 香港開源碳核算數據庫 · HK Carbon DB

> 開源、免費、可溯源的香港本地碳排放系數庫與核算工具。
> Open, free and fully sourced emission factors and carbon accounting tools for Hong Kong.

**狀態 / Status:** 第 0 階段（項目準備）· Phase 0 (setup). 數據仍是草稿，未可用於正式披露。Data is draft and not yet fit for formal reporting.

## 這是甚麼 / What this is

香港的碳數據散落在環保署、機電署、中電、港燈、煤氣等不同報告裏。本項目把這些數據整理成：

- **可溯源**：每個系數都附出處、頁碼或表號、年份
- **有版本**：所有修改都記錄在 Git，每次發佈可引用
- **機器可讀**：YAML 原始檔，發佈為 JSON / CSV
- **雙語**：繁體中文及英文

服務對象：市民（個人碳足跡）、企業及機構（範圍 1、2、3 核算）、政府及學界（開放數據、分析）。

## 目錄 / Layout

```
data/factors/<category>/   排放系數，一個 YAML 檔一個系數 / one factor per file
data/inventory/            全港排放清單時間序列 / HK inventory time series
sources/registry.csv       來源登記 / source registry
sources/archive/           原始文件存檔 / archived source documents
schema/                    數據格式、分類、單位 / schema, categories, units
methodology/               方法學說明 / methodology notes
scripts/                   校驗及構建 / validation and build
test/                      測試 / tests
```

## 快速開始 / Quick start

需要 Node.js 20 或以上。Requires Node.js 20+.

```bash
npm install
npm run validate   # 校驗所有數據 / validate all data
npm test           # 運行測試 / run tests
npm run build      # 生成 dist/factors.json、factors.csv / build release files
```

## 一個系數長甚麼樣 / What a factor looks like

```yaml
id: hk.energy.fuel.diesel.ipcc2006
name:
  zh-Hant: 柴油燃燒二氧化碳排放系數（IPCC 預設值）
  en: Gas/diesel oil combustion CO2 factor (IPCC default)
category: energy/fuel
gas: CO2
value: 74100
unit: kgCO2/TJ
year: 2006
region: GLOBAL
scope: 1
boundary: combustion
source:
  id: src-ipcc-2006-v2
  table: "Volume 2, Chapter 1, Table 1.4"
quality: C
status: draft
```

欄位定義見 [`schema/factor.schema.json`](schema/factor.schema.json)，質素等級見 [`methodology/data-quality.md`](methodology/data-quality.md)。

## 參與 / Contributing

歡迎提交數據、修正或程式碼。請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 授權 / License

- 程式碼 Code: [Apache-2.0](LICENSE)
- 數據 Data (`data/`, `sources/registry.csv`, `methodology/`): [CC BY 4.0](DATA_LICENSE.md)
- 第三方原始文件版權屬原出版者。Third-party source documents remain the property of their publishers.

## 免責聲明 / Disclaimer

本項目數據僅供參考。正式披露（如港交所 ESG 報告）請以官方公佈及核查機構意見為準。
Data is provided for reference only. For formal disclosure, rely on official publications and your verifier.
