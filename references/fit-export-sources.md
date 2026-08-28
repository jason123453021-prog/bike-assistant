# FIT 本機匯出技術依據

本 App 的 FIT 匯出必須保持 Local-First，僅以純 JavaScript／TypeScript 在裝置端產生二進位檔，再透過系統分享介面交給使用者；不得使用雲端轉檔服務、C++ 擴充或 NitroModules。

| 決策 | 依據 |
|---|---|
| 選擇純 JS／TS FIT writer | `@markw65/fit-file-writer` 提供 JS/TS 的 `FitWriter`，可寫入 `file_id`、`activity`、`session`、`lap` 與 `record` 訊息，並輸出 `DataView`／`Uint8Array`。 [1] |
| 用官方 SDK 作二進位完整性驗證 | Garmin JavaScript SDK 可在 JS 環境讀取 FIT 資料、檢查 `.FIT` 標頭、檔案長度與 CRC；官方 SDK 亦支援 Encoder。 [2] |
| FIT 格式定位 | Garmin 說明 FIT 為運動與健身裝置資料的緊湊、可互通格式，活動檔可含位置、速度、心率、功率與 session 資訊。 [3] |

## 驗收原則

1. 匯出內容必須包含有效 FIT header、CRC、`file_id`、`event`、`record`、`lap`、`session` 和 `activity`。
2. 單元測試以官方 JavaScript SDK 的 `Decoder.isFIT()` 與 `checkIntegrity()` 驗證。
3. 裝置端輸出後必須透過系統分享介面提供 `.fit` 檔；不將資料上傳至任何服務。

## 參考資料

[1]: https://github.com/markw65/fit-file-writer "markw65/fit-file-writer"
[2]: https://github.com/garmin/fit-javascript-sdk "Garmin FIT JavaScript SDK"
[3]: https://developer.garmin.com/fit/ "Garmin FIT SDK"
