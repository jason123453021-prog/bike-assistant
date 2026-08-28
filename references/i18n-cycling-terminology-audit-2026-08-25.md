# 自行車術語與通知文案校對紀錄

本輪以英文作為完整 fallback 基準，繁體中文維持單車使用者常見的「移動時間、總爬升、平均踏頻、平均功率」表述；其餘 11 種語系針對通知頻道、補給／補水提醒、通知 action 與匯出檔名前綴補入母語覆寫。未逐字翻譯的其餘 UI key 保留英文 fallback，而不顯示內部 key 或空字串。

| 概念 | 英文基準 | 繁體中文 | 校對準則 |
|---|---|---|---|
| Moving Time | Moving Time | 移動時間 | 與總經過時間分開；Strava 將其解釋為實際活動時間。[1] |
| Elapsed Time | Elapsed Time | 總時間／活動時間 | 包含等紅燈、休息與拍照停留。[1] |
| Elevation Gain | Elevation Gain | 總爬升 | Garmin 的 Total Ascent 是重設後累積上升的垂直距離。[2] |
| Cadence | Cadence / Avg Cadence | 踏頻／平均踏頻 | 自行車情境採曲柄轉數資料欄位語意。[2] |
| Power | Power / Avg Power | 功率／平均功率 | 保留瓦特（W）為跨語系單位。 |
| Hydration | Hydration reminder | 補水提醒 | 與能量補給提示分離，避免將水分與營養混為同一 action。 |

匯出檔名採「**當前語系前綴－活動名稱－ISO 日期**」：語系決定人類可讀的前綴，ISO 日期則讓檔案按日期排序並避免不同地區的日期順序造成歧義。GPX、FIT 與 SVG 分享圖卡共用同一服務。

## References

[1]: https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations "Strava：Moving Time, Speed, and Pace Calculations"
[2]: https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-A6B658F9-9A36-4FA5-80C9-26ABB46C4138.html "Garmin：Data Fields"
