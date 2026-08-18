# Android 騎乘背景持續顯示可行性評估

**日期：** 2026-08-18（GMT+8）  
**需求：** 騎乘開始後，使用者返回 Android 主畫面或切換其他 App 時，持續顯示類似 Google 地圖縮小導航的資訊。

## 官方平台結論

Android 的 **Picture-in-Picture（PiP）** 確實可將目前 Activity 縮小並由系統固定於螢幕角落；官方文件也將導航列為可用案例，並舉例 Google Maps 在導航時返回主畫面會維持方向顯示。[1] [2] 不過 PiP 是 Android Activity 層級能力，必須在 Android Manifest 宣告 `supportsPictureInPicture`，並以 Activity API 設定自動進入、轉場範圍及 PiP 狀態回呼。官方同時指出 PiP 的設計重心是影片、通話與導航的極簡內容；在 PiP 中，使用者不能操作一般 App UI，細小控制項不易辨識。[1] [2]

目前專案採 Expo Managed、只使用官方 Expo 模組、禁止自訂原生 C++／NitroModules。Expo SDK 54 的現成 PiP 介面位於 `expo-video` 的 `VideoView`，只適用於實際影片播放器，無法把 React Native 的 Leaflet 地圖、導航指令與騎乘儀表轉換為任意 App PiP 視窗。[3]

另一種做法是 `SYSTEM_ALERT_WINDOW` 系統級覆蓋層，但這是 Android 的特殊權限。使用者必須自行前往「特殊應用程式存取權」授權，App 每次執行敏感操作前都必須檢查結果並提供拒絕後的降級體驗。[4] 現有 Expo 官方模組並未提供用於任意 React Native 視圖的系統覆蓋層 API；先前專案內的懸浮窗項目也因永遠回報未授權、沒有實際渲染功能而在第二輪發布前品管中移除。

## 可行路徑比較

| 路徑 | 是否可得到圖示中的系統角落縮小窗 | 是否符合現有 Expo Managed／無原生模組約束 | 結論 |
|---|---:|---:|---|
| 原生 Android Activity PiP | 是 | 否；須加入並維護原生 Android Activity／config plugin 與 PiP API 橋接 | 需先取得使用者同意變更技術約束。 |
| `SYSTEM_ALERT_WINDOW` 覆蓋層 | 是 | 否；須特殊權限與原生 WindowManager 實作 | 不建議重新加入，除非明確接受特殊權限與原生實作。 |
| `expo-video` PiP | 僅影片 | 不適用本 App 的即時地圖與指令 | 不採用。 |
| 既有背景定位前景服務通知 | 否；顯示於通知列／鎖定畫面 | 是 | 維持為合規的背景騎乘狀態與返回 App 入口。 |

## 建議決策

若需求的關鍵是「從其他 App 或主畫面一眼看到下一轉向與距離」，應採用 **真正的 Android 原生 PiP**，而不是假性懸浮窗。這會改變目前「僅 Expo 官方模組、無自訂原生實作」的專案限制，並需要正式 Android build 與實體機驗收。

若必須維持現有技術限制，則不應宣稱能做出系統級縮小視窗；可以強化既有騎乘前景通知，使其提供下一指令、剩餘距離、速度及「返回導航」操作，但不會像圖例般浮在其他 App 之上。

## 參考資料

[1]: https://developer.android.com/develop/ui/views/picture-in-picture "Android Developers — Use picture-in-picture"
[2]: https://developer.android.com/design/ui/mobile/guides/home-screen/picture-in-picture "Android Developers — Picture-in-picture design guide"
[3]: ../../bike_assistant_helper/docs/media/video/DOCS.md "Expo SDK 54 — expo-video"
[4]: https://developer.android.com/training/permissions/requesting-special "Android Developers — Request special permissions"
