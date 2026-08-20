# 智慧單車騎乘助手 TODO

## 正式版 Expo OTA 停用（2026-08-20）
- [x] 檢閱 app.config.ts 的 updates、runtimeVersion 與正式 EAS profile 行為
- [x] 在正式 App 設定停用 Expo OTA 遠端更新與自動檢查
- [x] 新增設定守門，驗證 production config 停用 updates 且 Android Hermes 匯出維持可用
- [x] 交付 Expo Go 開發連線與正式 AAB 安裝版的測試邊界說明

## 管理預覽服務與 Expo tunnel 分離（2026-08-20）
- [x] 確認 ngrok tunnel 失敗會使唯一 Metro 程序退出，導致管理預覽顯示沙盒未啟動
- [x] 建立不依賴 Expo tunnel 的管理預覽 fallback，避免手機預覽因 tunnel 波動而中斷
- [x] 驗證 localhost、管理預覽與正式靜態 Web 均可持續回應
- [x] 交付預覽恢復與 Expo Go 正式 AAB 測試建議

## Expo Go tunnel 連線修復（2026-08-20）
- [x] 檢查 Expo tunnel、ngrok 相依與目前公開開發端點條件
- [x] 建立 Expo Go 專用 tunnel 開發端點並產生新的連線 URL
- [x] 修復 tunnel manifest 的 launch bundle URL 仍指向管理預覽代理的問題
- [x] 從外部驗證 tunnel 的 application/expo+json manifest 與 Android Hermes bundle
- [x] 交付手機端清除舊專案與重新掃描 tunnel URL 的步驟

## Expo Go 清除快取 tunnel 重建（2026-08-20）
- [x] 依使用者要求停止舊 tunnel、清除 Metro 快取並以 `--clear --tunnel` 重建
- [x] 擷取新的 Expo tunnel URL，確認其 manifest launch bundle 也使用 tunnel 網域
- [x] 從外部驗證新的 application/expo+json manifest 與 Android Hermes bundle
- [x] 交付新的 Expo Go 連線 URL 與手機重新掃描步驟

## Expo Go tunnel 傳輸最佳化（2026-08-20）
- [x] 分析 12.2 MB Android development bundle 的組成，確認標準開發 bundle 含 Expo Go 開發載入內容
- [x] 嘗試重建縮減後 tunnel；Expo CLI 在無開發模式下關閉 ngrok session，已回復為可建立且已外部驗證的標準 tunnel

## Expo Go tunnel 服務復原（2026-08-20）
- [x] 恢復已驗證的 Expo tunnel 設定並確認 ngrok session 可建立
- [x] 驗證新 tunnel manifest 與 Android Hermes bundle，並建立 Expo Go 專用 QR Code
- [x] 若 tunnel 無法穩定使用，交付正式 Android AAB 的不依賴 Expo Go 實機驗收路徑

## Expo Go 遠端更新連線深度修復（2026-08-20）
- [x] 比對外部公開端點與 localhost 的 Expo Go manifest、回應標頭、bundle URL 與內容一致性
- [x] 修復導致手機端無法下載遠端更新的 host URI、協定或 tunnel 連線問題
- [x] 建立實際 Android development manifest/bundle 連線守門並完成回歸
- [x] 交付手機端清除舊連線、重新掃描及正式 AAB 替代驗收步驟

## Expo Go 與管理預覽可用性修復（2026-08-19）
- [x] 診斷 Android Expo manifest、遠端 Hermes bundle 與管理預覽字型載入的失敗原因
- [x] 修復開發伺服器或預覽頁造成的遠端更新下載/字型逾時問題
- [x] 建立 Expo Go manifest、bundle 與預覽逾時回歸守門
- [x] 完成 Android Expo Go 連線、靜態 Web、TypeScript、Lint 與正式 Android 匯出驗證

## 發布前全機 QA/QC 與穩定性檢測（2026-08-19）
- [x] 建立核心計算、定位軌跡、背景復原、權限、離線與發布設定的稽核基準
- [x] 稽核距離、時間、速度、配速、坡度、爬升、卡路里與功率計算的邊界防護
- [x] 稽核 GPS 漂移/中斷、背景追蹤、崩潰恢復、計時器與訂閱清理的完整性
- [x] 稽核權限拒絕、離線回退、Safe Area、字體縮放、防誤觸與無效功能
- [x] 修復本輪可安全驗證的問題並補齊回歸守門
- [x] 完成 TypeScript、Lint、完整 Vitest、Expo Doctor、正式設定、Web 與 Android production 匯出
- [x] 修復離線地址搜尋失敗時顯示阻斷式 Alert 的行為，改為同頁非阻斷回退提示
- [x] 建立並交付發布前品管檢驗清單

## Android 字體縮放相容性（130%／200%，2026-08-19）
- [x] 盤點主要騎乘、導航、記錄、設定與彈窗的固定高度、單行截斷與文字溢位風險
- [x] 調整高風險文字列、按鈕、指標卡與彈窗為可換行、彈性高度且保留觸控目標的版面
- [x] 建立 130%／200% 字體縮放回歸守門，覆蓋共用容器與主要畫面
- [x] 修復靜態 Web 匯出後部署容器仍尋找 `dist/index.js` 的啟動相容性問題
- [x] 完成 TypeScript、Lint、完整測試、Expo Doctor 與 Android production 匯出驗證

## 上架前 QA/QC 與部署建置修復（2026-08-19）
- [x] 建立本次靜態程式、設定、相依與 Android production 匯出的稽核基準
- [x] 稽核正式版依賴、已棄用套件、機密與 release-safe 診斷邊界
- [x] 修復雲端部署 Web export 的 Metro `react-native-css-interop` 快取檔案阻擋問題
- [x] 稽核 SafeArea、深淺主題、字體縮放、例外處理、離線回退與資源釋放
- [x] 完成 TypeScript、Lint、完整 Vitest、Expo Doctor、靜態 Web 與 Android production 匯出驗證
- [x] 建立並交付本次上架前 QA/QC 品管結果總結報告

## 啟動體驗與部署建置修復（2026-08-19）
- [x] 診斷並修復模板清理後缺少 `build` script 的部署阻擋問題
- [x] 量測 App 根路由與首屏初始化工作，找出可延後或安全降級的阻塞操作
- [x] 優化 Splash Screen、首屏載入與初始化回饋，避免白屏或長時間無回應
- [x] 完成靜態建置、TypeScript、Lint、完整測試、Expo Doctor 與 Android production 匯出驗證

## Production 相依安全與模板模組整理（2026-08-19）
- [x] 建立 production 相依、Console 診斷與模板伺服器的實際使用基準
- [x] 執行 production dependency audit，分析並處理可修復的安全風險
- [x] 移除未被 Expo Android App 引用的模板伺服器、資料庫、OAuth 與社群模組
- [x] 清理未使用的舊版 Console 診斷，保留可控的開發期診斷工具
- [x] 完成 TypeScript、Lint、完整回歸、Expo Doctor 與 Android production 匯出驗證

## 上架前 QA/QC 與穩定性檢測（2026-08-19）
- [x] 建立目前版本基準，執行 TypeScript、Lint、Vitest、Expo Doctor 與設定解析檢查
- [x] 掃描相依套件、已棄用 API、原生外掛與正式 Android 預編譯／資產設定
- [x] 稽核 SafeArea、深淺主題對比、字體縮放與主要畫面可讀性
- [x] 稽核非同步例外、全域錯誤邊界、離線回退、監聽清理與重複渲染風險
- [x] 掃描硬編碼機密、前端日誌與本機資料儲存邊界
- [x] 新增全域錯誤邊界與正式版開發日誌守門，避免未捕捉例外造成白屏或洩漏內部錯誤
- [x] 移除自動暫停、恢復與完成事件的額外語音路徑，維持僅補給／補水兩種固定短句
- [x] 修復可重現的上架阻擋問題，完成回歸驗證與品管結果報告

## Expo 專案移轉至 jason1234530（2026-08-19）
- [x] 核對來源 Expo 專案與目標帳號 jason1234530 的可存取狀態
- [x] 確認移轉後保留 EAS projectId、Android package 與既有簽章的影響
- [x] 建立臨時 Expo 組織，並將 jason1234530 納入為管理員
- [x] 將 bike-assistant 移轉至臨時組織並更新 app.config.ts owner
- [x] 將 jason1234530 從 Admin 升格為臨時組織 Owner，以取得最終移轉權限
- [x] 由 jason1234530 完成最終移轉並驗證新帳號建置頁面

## 本機 Android EAS Local Build 指引（2026-08-19）
- [ ] 核對目前 Android 發布設定與本機建置所需的前置條件
- [ ] 整理使用者電腦可執行的 Local Build 流程、產物位置與故障排除步驟

## 免費雲端 Android 建置替代方案（2026-08-19）
- [x] 研究可支援 Expo SDK 54／Android APK 的免費雲端建置服務與目前額度限制
- [ ] 比較服務的 GitHub、簽章、APK 產物與隱私條件，確認適用方案
- [ ] 依使用者選擇設定雲端服務並啟動 Android 建置

## 基礎設定與 UI
- [x] 品牌色彩配置（極簡黑白+綠色 #00C896 強調）
- [x] 四標籤導覽（騎乘、導航、記錄、設定）
- [x] 應用圖示與品牌資訊（自行車輪+閃電）
- [x] icon-symbol 映射（完整 Material Icons 對應）

## 核心騎乘功能
- [x] GPS 速度追蹤（expo-location watchPositionAsync）
- [x] 虛擬功率計算（GPS 速度 + 高度 + 風阻）
- [x] 實時天氣顯示（Open-Meteo 免費 API）
- [x] 自動暫停/恢復（基於車速 < 2 km/h）
- [x] 卡路里進度條
- [x] 水分進度條

## 導航畫面精簡（2026-08）
- [x] 完全移除導航頁「騎乘紀錄中」狀態橫條，保留底部控制面板與系統通知的騎乘回饋
- [x] 移除未載入 GPX 時的頂部「前往路線頁面匯入 GPX 路線」引導提示
- [x] 修正確認清除導航圖層後殘留的 GPX 折線與里程數字標記：清除時直接命令 Leaflet 移除折線、端點、箭頭與公里數字，再同步更新 React 狀態
- [x] 將觸控鎖定中央遮擋卡改為右側小型狀態指示與短暫淡出提示
- [x] 移除觸控鎖定的向右滑動解鎖，新增可持久化的長按解除時間（毫秒）個人化設定並同步導航頁
- [x] 加入長按解除時的圓形倒數進度動畫，取消、放開與解鎖完成時正確重設
- [x] 長按解除期間顯示「長按中」提示，並在成功解除時提供一次輕微震動回饋
- [x] 長按解鎖成功時在右側鎖定按鈕位置短暫顯示綠色勾選圖示並淡出

## 騎乘活動摘要與媒體體驗（2026-08）
- [x] 在完成騎乘後摘要直接提供新增本機相片／影片入口，不必先前往歷史編輯頁
- [x] 重構歷史活動詳情頂部為主視覺媒體、路線地圖、成就與核心成績的沉浸式摘要
- [x] 將活動首張媒體實際呈現於活動主視覺與分享長圖，維持完全本機儲存
- [x] 無照片或影片時，以本機 GPS 軌跡生成深色地圖風格的活動主視覺封面

## Strava 風格離線活動頁強化（2026-08）
- [x] 研究 Strava 活動頁的完整功能並列出無登入、無雲端的 Local-First 對照表（references/strava-activity-local-first-gap-analysis.md）
- [x] 以本機數據補齊活動總覽、速度／海拔／功率曲線、每公里分段與路線分析入口
- [ ] 補齊個人成就、週／月目標、連續騎乘與活動洞察，不建立社群或帳號功能
- [x] 整合本機媒體、分享長圖、GPX／FIT 匯出與活動編輯流程
- [ ] 在活動詳情新增可切換的速度、海拔、功率、心率與踏頻分析曲線；資料不足時明確顯示本機空狀態
- [ ] 在曲線上提供距離／時間基準與點選讀值，顯示該位置的距離、時間、速度、海拔、坡度與可用感測資料
- [ ] 補齊本機最佳努力（功率曲線）、功率區間、心率區間、分段／圈數與路段 PR 的活動洞察
- [x] 加入可持久化的每週騎乘目標與自動計算的連續騎乘（Streak）卡片
- [x] 在活動詳情集中提供活動類型、裝備、RPE、私人備註、媒體、分享長圖、GPX／FIT 備份與刪除操作

## 補給系統
- [x] 動態補給閾值觸發（可在設定頁面調整）
- [x] 補給提醒 Modal（含彈出動畫）
- [x] 補充完畢後重置進度條
- [x] 補給時播放音效
- [x] 補給提醒實體音量鍵安全確認：確認 Expo 官方 API 不支援攔截，保留系統音量並提供 60px 放大快速確認按鈕

## 導航功能
- [x] GPX 檔案匯入與解析
- [x] 路線預估時間和卡路里
- [x] 高度剖面圖（純 SVG）

## 騎乘摘要
- [x] 騎乘數據統計（距離、時間、速度、功率、爬升、卡路里）
- [x] 功率分布圖表（5 區間圓餅圖）
- [x] 社群分享功能（系統 Share API）

## 回饋機制
- [x] 震動回饋（expo-haptics，可開關）
- [x] TTS 語音播報（expo-speech 中文，可開關）
- [x] 視覺通知（補給提醒 Modal）
- [x] 音效提醒（補給時播放 880Hz 提示音）

## 背景執行
- [x] 屏幕常亮（expo-keep-awake）
- [x] 背景 GPS 追蹤（expo-task-manager + foreground service）
- [x] 前台通知欄（顯示速度、距離、時間）
- [x] WAKE_LOCK 權限（避免系統強制關閉）

## 記錄功能
- [x] 騎乘記錄儲存（AsyncStorage，最多 100 筆）
- [x] 騎乘記錄列表（FlatList）
- [x] 騎乘詳情頁面（含功率分布圖）

## 設定功能
- [x] 個人資料設定（體重、身高、FTP）
- [x] 補給閾值設定（卡路里、水分 ml）
- [x] 通知/語音/震動/音效開關

## 整合更新（2025-06）
- [x] 騎乘與導航頁整合（map.tsx 統一管理）
- [x] 導航底部面板：上滑展開（完整儀表板）/ 下滑收縮（速度+時間）
- [x] 底部面板：天氣列、六格儀表板、卡路里/水分進度條
- [x] 標籤列更新：移除原騎乘標籤，導航頁為主入口
- [x] RideRecord 加入 name 欄位（路線命名）
- [x] GPS 點抽樣壓縮（最多 500 點，節省儲存空間）
- [x] 舊記錄向後相容遷移（自動補充 name 欄位）
- [x] 騎乘記錄詳細頁（ride-detail.tsx）：地圖軌跡回放
- [x] 記錄詳細頁：路線命名（點擊標題可編輯）
- [x] 記錄詳細頁：底部面板上拉展開（完整統計+功率分布）
- [x] 歷史記錄頁：加入「查看軌跡」按鈕
- [x] 歷史記錄頁：顯示路線名稱
- [x] icon-symbol 加入 pencil 映射

## GPX 共享與底部面板優化（2025-06 第二批）
- [x] 建立 GpxContext（lib/gpx-context.tsx）：路線頁與導航頁共享 GPX 資料
- [x] 在 _layout.tsx 加入 GpxProvider
- [x] 路線頁（navigate.tsx）匯入 GPX 後自動寫入 GpxContext
- [x] 導航頁（map.tsx）從 GpxContext 讀取 GPX，移除本地匯入按鈕
- [x] 導航頁底部面板預設高度為螢幕三分之一（六格：時間、速度、距離、坡度、功率、均速）
- [x] 上滑展開後顯示卡路里/水分進度條
- [x] GPX 路線有載入時右側工具列顯示清除按鈕
- [x] 無路線時顯示提示引導使用者前往路線頁匯入

## 爬升欄位與騎乘命名（2025-06 第三批）
- [x] 導航頁上拉面板加入總爬升資訊列（總爬升 m、即時坡度 %、最大功率 W）
- [x] 騎乘摘要 Modal 加入路線命名輸入框（預設依時段自動命名）
- [x] 摘要 Modal 點擊「儲存並完成」後更新歷史記錄中的路線名稱
- [x] RideContext saveRecord 接受可選 name 參數
- [x] updateRecordName 在 map.tsx 中正確解構使用

## 五項修正（2025-06 第四批）
- [x] 取消啟動初始畫面（index.tsx 重定向至導航頁）
- [x] 偏離指引開關（取代原回歸按鈕，可開啟/關閉偏離指引）
- [x] 偏離時實作逐步轉彎導航（OSRM steps 解析，顯示轉彎指令與距離）
- [x] 騎乘中地圖顯示綠色即時軌跡（GPX 導航與自由騎乘均顯示）
- [x] 補給 Modal 分別管理卡路里/水分，支援兩種通知重疊顯示，按下各自「已補充」才歸零

## Google Play 上架合規（2026-06）
- [x] 建立隱私政策頁面（app/privacy.tsx）
- [x] 後端帳號刪除 API（server/routers.ts deleteAccount mutation）
- [x] server/db.ts 加入 deleteUserById 函式
- [x] 設定頁面加入「刪除帳號」按鈕（帳號與好友區塊）
- [x] 設定頁面加入「隱私政策」連結（安全與隱私區塊）
- [x] icon-symbol.tsx 加入 doc.text.fill、trash.fill 映射
- [x] app.config.ts 更新權限宣告（背景位置、前台服務等）
- [x] app.config.ts 加入 expo-location 插件與位置權限說明文字
- [x] 建立 google-play-compliance.md（Store Listing 文字、資料安全聲明、內容分級）

## 商店截圖與防呆機制（2026-06）
- [ ] 刪除帳號：加入二次確認 Modal（輸入確認文字）
- [ ] 刪除帳號：刪除過程顯示載入動畫（ActivityIndicator）
- [ ] 刪除帳號：刪除成功/失敗顯示結果提示訊息
- [x] 刪除帳號：加入二次確認 Modal（輸入確認文字）
- [x] 刪除帳號：刪除過程顯示載入動畫（ActivityIndicator）
- [x] 刪除帳號：刪除成功/失敗顯示結果提示訊息
- [ ] 截取導航頁面截圖（騎乘中儀表板）— 使用者取消
- [ ] 截取設定頁面截圖（帳號區塊、安全與隱私）— 使用者取消
- [ ] 截取好友地圖截圖 — 使用者取消
- [ ] 截取卡路里補給通知截圖 — 使用者取消
- [ ] 截取水分補給通知截圖 — 使用者取消
- [ ] 後製截圖為 1080×1920px Google Play 標準尺寸 — 使用者取消

## 優先度 1-3 關鍵修復（v2.1 規格書）

### 優先度 1：均速異常修正
- [x] 分析均速計算邏輯（皆8.6 km / 54:04 min = 85.2 km/h，非 98.8 km/h）
- [x] 修正均速計算公式（確認是否混淆了有效騎乘時間與總時間）
- [x] 驗證上例騎乘記錄的均速修正結果

### 優先度 2：卡路里與水分流失重新計算
- [ ] 分析上例騎乘記錄異常（1745 kcal、3009 ml 明顯偏高）
- [ ] 重新推導卡路里計算公式（應為 ~850-1000 kcal）
- [ ] 重新推導水分流失公式（應為 ~1000-1200 ml）
- [ ] 修正計算邏輯並驗證結果

### 優先度 3：背景記錄穩定性
- [ ] 測試螢幕鎖定時是否持續記錄
- [ ] 測試 App 切至背景時是否持續記錄
- [ ] 測試關機重啟後是否恢復未完成的騎乘記錄
- [ ] 強化後台保活機制（WorkManager / JobScheduler）
- [ ] 修正 Android 版本相容性問題


## 補給系統優化與路線功能擴展（v2.2）
### 補給系統優化
- [x] 設定頁面加入補給品清單管理（新延/編輯/刪除補給品）
- [x] 補給品支援自訂名稱、觸發時間、觸發距離
- [x] 補給品重複提醒選項（只提醒一次/每次/不提醒）
- [x] 補給 Modal 動態顯示自訂補給品清單

### 路線功能擴展
- [x] 騎乘記錄支援 GPX 匯出功能
- [x] 路線最愛管理（新延/刪除/搜尋）
- [x] 好友騎乘軌跡 GPX 下載
- [x] 好友軌跡直接套用至導航系統

## 補給品預設範本庫與騎乘統計（v2.3）
### 補給品預設範本庫
- [x] 在 settings-context.tsx 中定義預設補給品樣板（能量棒、電解質饮料、水、鹿茶等）
- [x] 在 settings.tsx 中新增「快速新延」按鈕区域
- [x] 實現一鍵新延預設補給品功能

### 騎乘統計與路線分析
- [x] 在 ride-context.tsx 中新增路線統計資料（騎乘次數、平均速度、最佳成績）
- [x] 在 ride-detail.tsx 中新增「路線統計」面板
- [x] 顯示詳情頁詳次數、平均速度、最佳成績、总爆升

## 第二階段補充功能（功能擴展）
### 補給品清單管理與雙模式演算法
- [x] 補給品清單支援分類與優先級設定
- [x] 實現補給品推薦演算法（基於騎乘強度、時間、距離）
- [x] 補給品消耗統計與歷史記錄

### 三段式效能模式 + 低電量管理
- [x] 在設定頁面新增效能模式選項（省電、平衡、性能）
- [x] 根據電量百分比自動調整模式
- [x] 省電模式下降低 GPS 精度、減少螢幕更新頻率
- [x] 性能模式下提升數據採樣率與螢幕刷新率

### GPX 匯入功能
- [x] 支援從檔案系統選擇 GPX 檔案
- [x] 解析 GPX 檔案並提取軌跡點、海拔、時間戳
- [x] 預估騎乘距離、爬升、預計時間
- [x] 將匯入的路線套用至導航地圖


## 騎乘記錄改進與功能修復（v2.8）
- [x] 本機個人最佳紀錄：結束騎乘時比較最長距離、最高總爬升與最佳均速，並在詳情頁顯示
### 騎乘記錄完整資訊
- [ ] 新增核心數據面板（距離、時間、速度、熱量）
- [ ] 新增爬升與地形面板（爬升、下降、海拔）
- [ ] 新增進階訓練數據（心率、功率、踏頻）
- [ ] 新增表現指標（訓練效果、個人紀錄、分段數據）
- [ ] 新增圖表分析（心率區間、功率曲線、爬坡分析）

### 功能修復
- [ ] 修復 GPX 匯出失敗問題
- [ ] 修復感測器配對虛假狀態
- [ ] 修復補給品新增 Modal 顯示位置
- [ ] 修復分享卡片顯示錯誤
- [x] 新增補給品計數至導航上拉頁面

## 實時感測器數據集成（v2.9）
### 感測器數據流集成
- [x] 在 map.tsx 中新增感測器狀態管理（心率、功率、踏頻）
- [x] 騎乘開始時初始化感測器數據更新迴圈（每 1 秒更新）
- [x] 騎乘結束時清理感測器更新迴圈
- [x] GPS 位置更新中優先使用感測器功率，若無則使用計算功率
- [x] 儀表板顯示優先使用感測器功率，並標記感測器來源
- [x] 精簡導航模式優先使用感測器功率
- [x] 在設定頁面中新增心率與踏頻欄位開關
- [x] 在 RideRecord 中新增心率與踏頻統計欄位
- [x] 在 map.tsx 中追蹤感測器平均與最大值
- [x] 在 DashMetric 中新增心率與踏頻顯示
- [x] 在 ride-detail.tsx 中顯示感測器數據（平均心率、最大心率、平均踏頻、最大踏頻）
- [x] 在 saveRecord 中計算並儲存感測器數據
- [x] 實現感測器數據平滑優化（心率、踏頻 5 點移動平均）
- [x] 在 DashMetric 中使用平滑數據顯示
- [x] 實現心率區間分析圓餅圖（基於平均心率估算）
- [x] 在設定頁面中新增感測器狀態面板
- [x] 在 SensorDataManager 中新增 getSensorStatus 方法
- [x] 在 SensorDataManager 中實現信號質量計算
- [x] 在設定頁面中連接 SensorDataManager 的感測器狀態
- [x] 定時更新感測器統計信息（每 1 秒）
- [x] 展示已連接設備數、最後更新時間、信號強度
- [ ] 測試端對端感測器數據流（配對 → 連接 → 實時顯示）
- [ ] 驗證感測器數據平滑與準確性

## UI 优化与分享功能改進（v2.11）
### UI 优化
- [x] 补給品 Modal 置中顯示
- [x] 移除路線分析頁面的「匹入 GPX」按鈕
- [x] 移除补給品預設值樣板
- [x] 补給品時間觸發改成時/分/秒自訂欄位

### 分享功能改進
- [x] 擴展 ShareCard 介面以支援更多數據（核心、爆升、進階訓練）
- [x] 在 RideRecord 中新增缺失欄位（totalDescent、maxElevation、movingTime、normalizedPower、intensityFactor、tss）
- [x] 在分享卡片中新增進階數據顯示（心率、功率、踏頻）
- [x] 改善 GPX 匯出，包含完整騎乘統計資訊（距離、時間、速度、功率、心率、踏頻等）

## BLE GATT 標準規範整合（v2.12）
### 第一階段：BLE 管理器建立
- [ ] 建立 BleManager 類別（lib/ble-manager.ts）
- [ ] 實現 BluetoothLeScanner 掃描邏輯（過濾 GATT 服務 UUID）
- [ ] 實現設備連線與服務發現（discoverServices）
- [ ] 實現 CCCD 設定與特徵訂閱（enableNotification）
- [ ] 實現連線狀態監聽與回調機制

### 第二階段：標準 GATT 服務實現
- [ ] 心率服務（0x180D）與特徵（0x2A37）
- [ ] 功率計服務（0x1818）與特徵（0x2A63）
- [ ] 踏頻服務（0x1816）與特徵（0x2A5B）
- [ ] 設備資訊服務（0x180A）與特徵（製造商、型號）

### 第三階段：數據解析
- [ ] 心率數據解析（Little-Endian 位元組順序）
- [ ] 功率數據解析（功率值、踏頻、扭矩等）
- [ ] 踏頻數據解析（累積轉數、時間戳）
- [ ] 數據驗證與異常處理

### 第四階段：SensorDataManager 整合
- [ ] 將 BleManager 整合至 SensorDataManager
- [ ] 實現設備掃描與自動連線
- [ ] 實現多設備管理（心率 + 功率 + 踏頻）
- [ ] 實現數據流轉換與平滑

### 第五階段：連線穩定性
- [ ] 實現斷線自動重連機制
- [ ] 實現連線超時檢測
- [ ] 實現信號強度監控（RSSI）
- [ ] 實現前台服務保活（Foreground Service）

### 第六階段：UI 與設定
- [ ] 在設定頁面新增「BLE 設備掃描」按鈕
- [ ] 新增「已配對設備列表」面板
- [ ] 新增「設備連線狀態」實時顯示
- [ ] 新增「手動連線/斷線」控制

### 第七階段：測試與驗證
- [ ] 使用 nRF Connect 驗證 GATT 結構
- [ ] 測試心率帶連線與數據讀取
- [ ] 測試功率計連線與數據讀取
- [ ] 測試踏頻器連線與數據讀取
- [ ] 測試多設備同時連線
- [ ] 測試斷線重連機制

## UI 優化與重構（v2.14）
- [x] 放大補給品 Modal 欄位輸入區域，減少拖動需求
- [x] 刪除騎乘記錄頁面的重複資訊內容
- [x] 改進騎乘記錄頁面的上拉滑動邏輯，與導航頁面一致
- [x] 實現騎乘軌跡回放功能（播放/暫停/速度調整）
- [x] 改進騎乘記錄上拉頁面為拉桿拖動模式
- [ ] 新增分段統計功能（每 5km 或 15 分鐘）
- [x] 軌跡回放地圖自動跟隨功能（地圖中心跟隨回放位置、顯示實時數據）
- [x] 補給品提醒優先級排序和合併顯示
- [x] 軌跡回放進度百分比顯示和進度條視覺化
- [x] 補給品提醒通知堆疊卡片實現（合併顯示、優先級排序、獨立確認）


## 騎乘結束時自動保存坡度分布（v2.15）
- [x] 修改 saveRecord 函數，自動包含 gradeDistribution 和 gradeAscentDistribution 數據
- [x] 確認騎乘結束時正確調用 saveRecord 函數
- [x] 驗證騎乘記錄詳細頁面正確顯示坡度分布數據


## 四項核心改進（v2.16）
### 一. 均速異常改善
- [x] 分析均速計算邏輯，發現 saveRecord 時直接使用 state.avgSpeed
- [x] 修正 saveRecord 函數，在保存時重新計算最終均速
- [x] 確保所有均速顯示都來自同一個計算來源

### 二. 坡度異常改善
- [x] 分析坡度計算邏輯，發現 distance 計算不一致
- [x] 修改 LOCATION_UPDATE 類型以包含真實 GPS 距離
- [x] 修正坡度計算邏輯，優先使用真實距離而不是速度推算
- [x] 修正坡度分類邏輯，平坦路段不再被誤分類為 26%+

### 三. 背景執行補給通知改善
- [x] 確認 SupplyModal 已實現全屏彈窗
- [x] 改善系統通知設定，添加 badge 和 categoryIdentifier
- [x] 確保補給通知在背景執行時能正確觸發

### 四. 車頭朝前導航功能
- [x] 確認地圖組件已支持 setBearing 方法
- [x] 驗證低通濾波實現（7 點循環平均，角度向量平均）
- [x] 驗證 GPS vs 磁力計邏輯切換（速度 > 5 km/h 使用 GPS）
- [x] 添加 setPitch 方法到地圖 API
- [x] 實現根據速度動態調整俯視角（0-45 度）



## 卡路里與水分流失重新計算（v2.17）
### 一. 卡路里計算改善
- [x] 分析當前卡路里計算邏輯，發現效率係數錯誤（0.75 應為 0.25）
- [x] 修正卡路里計算公式，使用正確的效率係數 0.25
- [x] 添加基於 MET 的卡路里計算方法（備選方案）
- [x] 修改 map.tsx 使用新的計算邏輯

### 二. 水分流失計算改善
- [x] 分析當前水分流失計算邏輯，發現基礎率過高（0.5 L/h）
- [x] 降低基礎率至 0.3 L/h（更符合實際騎乘流失）
- [x] 添加水分流失上限限制（100-1500 ml/h）
- [x] 防止指數級增長導致的異常值

### 三. 驗證與文檔
- [x] 創建公式文檔（docs/energy-hydration-formula.md）
- [x] 記錄新舊公式對比與驗證例子


## 訓練效果分析 - TSS 計算（v2.18）
- [x] 分析 TSS 計算公式與騎乘數據需求
- [x] 實現 TSS 計算函數（tss-calc.ts）
- [x] 在 saveRecord 中計算並保存 TSS 數據
- [x] 在騎乘詳細頁面顯示 TSS、強度係數、標準化功率


## 訓練負荷與恢復建議（v2.19）
- [ ] 在 tss-calc.ts 中添加訓練負荷計算函數
- [ ] 在 RideRecord 中添加 trainingLoad 欄位
- [ ] 在 saveRecord 中計算並保存訓練負荷
- [ ] 在騎乘詳細頁面顯示訓練負荷等級和恢復建議

## 周期訓練統計（v2.20）
- [ ] 在 activity-stats.ts 中添加周期統計函數
- [ ] 計算本周、本月、本年的總 TSS 和平均 TSS
- [ ] 在統計頁面新增「本週訓練負荷」面板
- [ ] 顯示平均 TSS、訓練天數、訓練強度分布

## FTP 自適應調整（v2.21）
- [ ] 在 tss-calc.ts 中添加 FTP 自適應計算函數
- [ ] 根據歷史騎乘的最大功率自動調整 FTP 估算值
- [ ] 在設定頁面顯示當前 FTP 值和自動調整建議
- [ ] 實現 FTP 自動更新邏輯（每 10 次騎乘更新一次）


## 三項後續功能實現（v2.19-2.21）
- [x] 訓練負荷與恢復建議 — 在騎乘詳細頁面顯示訓練負荷等級和建議恢復時間
- [x] 周期訓練統計 — 在歷史記錄頁面新增本周/本月訓練統計面板
- [x] FTP 自適應調整 — 實現根據歷史最大功率自動調整 FTP 的函數


## Bug 修復（v2.22）
- [x] 修復軌跡播放閃退 — 將 setView 改為 animateCamera
- [x] 修復補給品 Modal 底部按鈕被海苔條遮擋 — 使用 SafeAreaView 自動處理


## 心率區間優化（v2.23）
- [x] 分析當前心率區間計算邏輯
- [x] 實現心率最大值自動偵測功能
- [x] 實現心率區間自動校準功能
- [x] 在騎乘詳細頁面顯示心率區間 BPM 範圍


## 軌跡回放增強功能（v2.24）
- [x] 實現軌跡回放標點著色功能（按速度：綠→黃→紅）
- [x] 實現地圖方向旋轉（根據行進方向）
- [x] 實現俯視角度動態調整（根據坡度 0-45°）
- [x] 整合彩色標點與地圖旋轉到回放流程
- [x] 測試驗證軌跡回放視覺效果


## 軌跡回放進階功能（v2.25）
- [x] 實現速度曲線圖組件（顯示整個騎乘過程的速度變化）
- [x] 實現關鍵點標記（最高速度、最大功率、最大心率等）
- [x] 實現關鍵點點擊跳轉和詳細數據顯示
- [x] 整合速度曲線和關鍵點到回放流程
- [x] 測試驗證軌跡回放進階功能


## 速度曲線圖手勢控制（v2.26）
- [x] 實現曲線圖手勢識別（水平滑動）
- [x] 實現時間點計算和回放位置更新
- [x] 實現視覺反饋（滑動時顯示當前位置指示器）
- [x] 整合手勢控制到回放流程
- [x] 測試驗證手勢導航功能


## 軌跡回放地圖抖動改善（v2.27）
- [x] 分析地圖抖動原因（高頻率更新、數據點過密集等）
- [x] 實現相機更新的低速率控制（降低更新頻率）
- [x] 實現相機位置平滑插值（Lerp 或 Catmull-Rom）
- [x] 實現數據點採樣和平滑標誌
- [x] 最佳化回放時間間隔和暫停時間
- [x] 測試驗證地圖穩定性和流暢度


## 回放控制面板優化（v2.28）
- [x] 添加回放速度預設按鈕（0.5x、1x、2x、4x）
- [x] 刪除速度曲線圖下方的「速度」和「最大功率」欄位
- [x] 測試驗證回放控制功能
- [x] 保存檢查點


## 回放統計卡片和軌跡高亮（v2.29）
- [x] 實現回放統計卡片組件（顯示速度、心率、功率等實時數據）
- [x] 實現軌跡高亮功能（已走過的軌跡用不同顔色標記）
- [x] 實現方向箭头標記（在關鍵轉折點添加方向指示）
- [x] 整合統計卡片和軌跡高亮到回放流程
- [x] 測試驗證並保存檢查點


## 軌跡回放優化（v2.30）
- [x] 實現回放統計卡片自動展開功能（按下回放時自動顯示）
- [x] 重新設計回放速度控制欄位排版（解決重疆問題）
- [x] 改善地圖回放平滑性（實現相機平滑插值）
- [x] 添加地圖方向控制按鈕（指北 vs 朝向行進方向）
- [x] 測試驗證並保存檢查點


## 補給系統和頁面優化（v2.31）
- [x] 實現補給系統背景通知和螺幕點亮功能
- [x] 重新排版騎乘記錄資訊頁面（軌跡回放欄位移至最上方）
- [x] 實現回放速度滑桿控制
- [x] 實現補給品欄位自適應或滑桿功能
- [x] 測試驗證並保存檢查點


## 回放功能和補給品欄位優化（v2.32）
- [x] 修謈回放速度滑桿實時曲新機制
- [x] 調整回放統計卡片位置到地圖左上方
- [x] 優化補給品欄位自適應顯示（改為距離和時間計數）
- [x] 測試驗證並保存檢查點


## 回放統計卡片位置調整（v2.33）
- [x] 分析回放統計卡片的當前位置和新位置
- [x] 實現回放統計卡片的位置移動（移至騎乘記錄下方）
- [x] 實現自適應欄位大小和儀表板縮放
- [x] 測試驗證並保存檢查點


## UI 審計與修正（v2.34）
- [x] 掃描應用程式碼庫找出所有問號圖示
- [x] 替換問號圖示為合適的圖示（補給品圖示等）
- [x] 修正相關文本和標籤
- [x] 全面檢查應用程式文本，修正錯字
- [x] 驗證應用程式資訊完整性和圖片顯示正確性
- [x] 測試驗證並保存檢查點


## Android 優化與功能增強（v2.44+）
- [x] 建立技術方案文檔（ANDROID_OPTIMIZATION_PLAN.md）
- [x] 實施自動暫停狀態機（雙閾值滊後） - lib/auto-pause-fsm.ts
- [x] 集成 GPS 與羅盤融合導航 - lib/heading-fusion.ts
- [x] 實施加速度計感測器融合 - lib/accelerometer-fusion.ts
- [x] 功耗管理與動態休眠 - lib/power-management.ts
- [x] 統一優化管理器 - lib/android-optimization-manager.ts
- [ ] Foreground Service 與背景權限實施
- [ ] 情感化 UX 改進（Haptic + TTS）
- [ ] 端到端測試與驗證


## Foreground Service 與情感化 UX（v2.49+）
- [x] 實施 Foreground Service 與背景權限 - lib/foreground-service.ts
- [x] 實施 Haptic 反饋整合 - lib/emotional-ux.ts
- [x] 實施 TTS 語音提示整合 - lib/emotional-ux.ts
- [x] UI 調整 - 統計面板移至頂部（地圖上方）
- [x] 統計面板半透明化設置 (rgba 75%)
- [x] 集成 Foreground Service 到 map.tsx 驗證開始部分
- [x] 集成情感化 UX 到自動暂停、恢複、低電量事件
- [x] 集成情感化 UX 到騎乘完成事件
- [ ] 端到端測試與驗證


## UI 面板位置調整（v2.54+）
- [x] 調整 map.tsx 騎乘開始面板從頂部移至地圖下方
- [x] 調整 ride-detail.tsx 統計面板從底部移至軌跡回放上方 (軌跡回放已在最上方)
- [x] 測試驗證並保存檢查點

## 軌跡回放欄位移除（v2.55）
- [x] 從 ride-detail.tsx 中移除所有軌跡回放 UI 元素
- [x] 移除軌跡回放相關的狀態變數和選擇邏輯
- [x] 移除軌跡回放相關的樣式定義
- [x] 移除軌跡回放相關的導入


## Relive 軌跡回放頁面實現（v2.56+）

### 第一階段：軌跡回放頁面（2D 地圖、統計、照片時間軸）
- [ ] 建立 relive.tsx 頁面（新標籤頁或獨立頁面）
- [ ] 實現 2D 地圖軌跡顯示（Leaflet 地圖、彩色軌跡、起終點標記）
- [ ] 實現軌跡回放播放控制（播放/暫停、速度調整、進度條）
- [ ] 實現實時統計數據顯示（當前速度、距離、時間、海拔、功率）
- [ ] 實現照片時間軸錨定（讀取 EXIF、時間軸比對、彈出展示）
- [ ] 實現高光時刻標記（最高時速、最高海拔、陡坡挑戰）
- [ ] 實現數據統計圖表（速度曲線、心率區間、功率分布）

### 第二階段：影片生成與社群分享
- [ ] 後端實現軌跡截圖序列生成（Puppeteer + Mapbox）
- [ ] 後端實現影片合成（FFmpeg、背景音樂、字幕）
- [ ] 實現影片下載功能
- [ ] 實現社群分享功能（Instagram、Facebook、WhatsApp）
- [ ] 實現分享卡片生成（數據總結、品牌水印）

## Relive 軌跡回放頁面實現完成（v2.56）

### 第一階段：軌跡回放頁面（2D 地圖、統計、照片時間軸）✅
- [x] 建立 relive.tsx 頁面（新標籤頁或獨立頁面）
- [x] 實現 2D 地圖軌跡顯示（Leaflet 地圖、彩色軌跡、起終點標記）
- [x] 實現軌跡回放播放控制（播放/暫停、速度調整、進度條）
- [x] 實現實時統計數據顯示（當前速度、距離、時間、海拔、功率）
- [x] 實現詳細統計展示（核心數據、爬升與地形、進階訓練數據）
- [x] 在歷史記錄頁面添加「Relive」按鈕

### 第二階段：分享功能✅
- [x] 實現統計數據分享（Share API）
- [x] 支援 iOS/Android 系統分享菜單
- [x] 分享內容包含騎乘數據（距離、時間、速度、卡路里、爬升）

### 待實現功能
- [ ] 照片時間軸錨定（EXIF 讀取、時間軸比對、彈出展示）
- [ ] 高光時刻標記（最高時速、最高海拔、陡坡挑戰）
- [ ] 數據統計圖表（速度曲線、心率區間、功率分布）
- [ ] 影片生成功能（Puppeteer + FFmpeg 後端）


## Relive 軌跡回放與分享功能實現（v2.56-v2.57）
- [x] 軌跡回放頁面（relive.tsx）— 2D 地圖軌跡、播放控制、實時統計
- [x] 播放控制功能 — 播放/暫停、速度調整（0.5x-4x）、進度條
- [x] 實時統計面板 — 速度、距離、時間、海拔、功率
- [x] 詳細統計展示 — 核心數據、爬升地形、進階訓練數據
- [x] 高光時刻標記 — 最高時速、最高海拔、陡坡挑戰
- [x] 數據圖表展示 — 速度分布、心率區間、功率分布
- [x] 統計數據分享 — 系統分享菜單（iOS/Android）
- [x] 歷史記錄集成 — 「Relive」按鈕快速訪問
- [ ] 照片時間軸錨定 — EXIF 讀取與時間軸比對（待實現）
- [ ] 軌跡回放中的照片彈出展示（待實現）


## 照片時間軸與軌跡回放動畫優化（v2.58）
- [x] 照片時間軸錨定 — EXIF 類型定義、模擬照片加載、時間軸比對（2 秒容差）
- [x] 照片彈窗展示 — 半透明遮罩、照片卡片、關閉按鈕
- [x] 軌跡漸進繪製 — 隨著回放進度逐步繪製已走軌跡（綠色）
- [x] 平滑相機跟隨 — 300ms 動畫時間平滑移動到當前回放位置


## 騎乘數據導出功能實現（v2.59）
- [x] GPX 格式導出 — 生成標準 GPX 文件，包含軌跡座標、時間戳、海拔、速度
- [x] 導出按鈕 UI — 在 Relive 頁面展開面板中添加導出數據區域
- [ ] FIT 格式導出 — 待實現（Garmin 標準格式）


## FIT 格式導出與騎乘社群互動功能實現（v2.60）
- [x] FIT 格式導出 — CSV 格式，包含完整騎乘數據（日期、時間、座標、海拔、速度、心率、功率、踏頻）
- [x] 按讚功能 — 用戶可為騎乘記錄點讚，顯示讚數和按讚狀態
- [x] 評論功能 — 用戶可添加評論，支援評論列表展示、作者名稱、時間戳
- [x] 社群互動 UI — 在 Relive 頁面實時統計面板後添加社群互動按鈕和評論區域


## 好友互動分享功能（v3.1）
### 第一階段：數據模型和後端 API
- [x] 在 drizzle/schema.ts 中添加 rideShares 表（分享記錄）
- [x] 在 drizzle/schema.ts 中添加 shareComments 表（分享評論）
- [x] 執行數據庫遷移
- [x] 在 server/social-router.ts 中添加分享相關 API
  - [x] shareRide：分享騎乘記錄至好友
  - [x] getSharedRides：獲取分享給我的騎乘記錄
  - [x] getMySharedRides：獲取我分享的騎乘記錄
  - [x] unshareRide：取消分享
  - [x] addShareComment：在分享記錄上添加評論

### 第二階段：分享 UI 和交互
- [x] 在 relive.tsx 中添加「分享至好友」按鈕
- [x] 建立分享模態框組件（ShareModal.tsx）
  - [x] 好友列表選擇
  - [x] 分享備註輸入
  - [x] 分享權限設置（可評論、可點讚等）
- [x] 實現分享成功提示

### 第三階段：分享記錄頁面
- [ ] 建立分享記錄頁面（app/shared-rides.tsx）
  - [ ] 分享給我的騎乘記錄列表
  - [ ] 我分享的騎乘記錄列表
  - [ ] 分享者信息展示
  - [ ] 分享時間和備註
- [ ] 實現分享記錄詳情頁
  - [ ] 查看分享的騎乘軌跡
  - [ ] 添加評論和點讚
  - [ ] 查看分享者和其他評論者的互動

### 第四階段：集成和測試
- [ ] 在標籤導航中添加分享記錄頁面
- [ ] 測試分享功能端對端流程
- [ ] 測試好友互動（點讚、評論）
- [ ] 優化 UI 和用戶體驗


## Bug 修復 - 海苔條高度和滑動問題（v3.2）
- [x] 修正海苔條高度自適應 - 按鈕高度隨內容動態調整
- [x] 修正滑動面板無法捲動到最下方 - ScrollView 內容被截斷
- [x] 驗證修復效果

## 嚴重 Bug 修復 (Android 原生)

- [ ] **Bug 1：背景與鎖屏狀態下 GPS 軌跡失效（切西瓜現象）**
  - [ ] 檢查 AndroidManifest.xml 權限聲明 (ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE_LOCATION)
  - [ ] 實現原生 Foreground Service
  - [ ] 實現原生 WakeLock
  - [ ] 與 React Native 橋接

- [ ] **Bug 2：鎖屏狀態下「無語音播報、未點亮螢幕、無彈窗」**
  - [ ] 實現 Activity 中的 setShowWhenLocked(true) 和 setTurnScreenOn(true)
  - [ ] 申請 WAKE_LOCK 權限並使用 ACQUIRE_CAUSES_WAKEUP 強制點亮螢幕
  - [ ] 確保 App 的 Audio Service 在背景狀態下擁有播放權限與焦點 (Audio Focus)
  - [ ] 與 React Native 橋接

- [ ] **Bug 3：實體「音量鍵」無法關閉通知彈窗**
  - [ ] 在彈窗元件或 Activity 中覆寫按鍵監聽事件
  - [ ] 捕捉 KeyEvent.KEYCODE_VOLUME_DOWN 與 KeyEvent.KEYCODE_VOLUME_UP
  - [ ] 攔截事件並呼叫關閉彈窗的 function
  - [ ] 與 React Native 橋接


## Phase 1：首次啟動權限引導機制 ✅

- [x] 創建 PermissionsManager.ts - 權限檢查和請求邏輯
- [x] 創建 PermissionsOnboardingModal.tsx - 權限 onboarding UI
- [x] 在 app/_layout.tsx 中集成權限檢查和彈窗
- [x] 支援位置、通知、懸浮窗、電池最佳化權限
- [x] 首次啟動時自動顯示，完成後標記為已完成


## Phase 2：動態權限檢測和電池最佳化監控 ✅

- [x] 創建 PermissionMonitor.ts - 定期檢測權限變化
- [x] 創建 BatteryOptimizationMonitor.ts - 電池最佳化狀態監控
- [x] 創建 usePermissionMonitoring.ts - App 層監控 Hook
- [x] 在 app/_layout.tsx 中集成權限監控
- [x] 權限撤銷時自動提示用戶
- [x] 電池最佳化狀態變化時提示用戶（避免頻繁提示）


## Phase 3：導航 UI Google Maps 風格重構 ✅

- [x] 創建 GoogleMapsStyleNavigation.tsx - 頂部搜尋欄、右側浮動工具列、底部路線卡片
- [x] 實現搜尋欄交互（搜尋地點）
- [x] 實現浮動工具列（圖層、我的位置、方向）
- [x] 實現底部路線卡片（展開/收縮）

## Phase 4：搜尋欄和路線選擇優化 ✅

- [x] 創建 RouteSearchAndSelection.tsx - 完整的路線搜尋和選擇組件
- [x] 實現地址搜尋功能（起點、終點、交換）
- [x] 實現多條路線選擇（最快、最短、最平緩）
- [x] 實現路線詳細資訊顯示（距離、時間、爬升）
- [x] 實現路線選擇和開始騎乘功能


## Phase 5：轉向導航和 GPX 最佳化 ✅

- [x] 創建 TurnByTurnNavigation.ts - 轉向導航管理器
- [x] 實現轉向指令解析和追蹤
- [x] 實現偏離路線檢測
- [x] 實現轉向語音提示生成
- [x] 創建 GpxOptimizer.ts - GPX 軌跡最佳化和壓縮
- [x] 實現 Douglas-Peucker 算法軌跡簡化
- [x] 實現軌跡點採樣和冗餘移除
- [x] 實現軌跡平滑（移動平均）
- [x] 實現軌跡分段（按距離或時間）
- [x] 實現軌跡統計計算


## Phase 6：導航中斷和軌跡恢復機制 ✅

- [x] 創建 NavigationRecoveryManager.ts - 導航檢查點保存和恢復
- [x] 實現定期自動同步檢查點
- [x] 實現網絡中斷時的離線模式
- [x] 實現 App 崩潰時的狀態恢復
- [x] 實現恢復進度計算和建議

## Phase 7：背景執行穩定性增強 ✅

- [x] 創建 BackgroundStabilityManager.ts - 背景執行穩定性管理
- [x] 實現前台服務保活
- [x] 實現心跳監控機制
- [x] 實現背景時間追蹤
- [x] 實現異常恢復機制


## Phase 8：最終測試和發布準備 ✅

- [x] 創建 integration.test.ts - 完整的集成測試套件
- [x] 權限管理集成測試
- [x] 轉向導航單元測試
- [x] GPX 優化功能測試
- [x] 導航恢復集成測試
- [x] 端到端流程測試
- [x] 創建 RELEASE_CHECKLIST.md - 發布檢查清單
- [x] TypeScript 編譯 0 errors
- [x] 所有功能集成完成


## 語音提示功能 ✅

- [x] 創建 TurnVoiceNotificationManager.ts - 轉向導航語音提示管理器
- [x] 實現接近轉彎時自動播放語音提醒
- [x] 支援多語言（繁體中文、英文）
- [x] 可配置語音速率、音量、音調
- [x] 實現靜音模式和重複播放
- [x] 創建 useVoiceTurnNotification.ts - Hook 集成
- [x] 創建 VoiceTurnNotificationProvider.tsx - Context 提供者
- [x] 創建 VoiceSettingsPanel.tsx - 語音設置面板
- [x] 創建 NavigationWithVoiceExample.tsx - 集成示例
- [x] 創建 voice-notification.test.ts - 完整測試套件
- [x] TypeScript 編譯 0 errors


## 實時導航與語音提示集成 ✅

- [x] 創建 RealtimeNavigationManager.ts - 實時導航管理器
- [x] 實現 GPS 位置追蹤與語音提示同步
- [x] 自動轉向指令觸發邏輯
- [x] 偏離路線檢測與語音提醒
- [x] 導航進度實時更新
- [x] 創建 useRealtimeNavigation.ts - React Hook
- [x] 創建 RealtimeNavigationScreen.tsx - 完整 UI 組件
- [x] 創建 realtime-navigation.test.ts - 完整測試套件
- [x] 創建 REALTIME_NAVIGATION_INTEGRATION.md - 集成文檔
- [x] TypeScript 編譯 0 errors


## 離線地圖快取與語音包預先下載 ✅

- [x] 創建 OfflineMapCacheManager.ts - 地圖瓦片快取管理
- [x] 實現 LRU 快取策略和大小限制
- [x] 支援多地圖源（OpenStreetMap）
- [x] 區域瓦片批量下載
- [x] 創建 OfflineVoicePackageManager.ts - 語音包管理
- [x] 語音包下載和本地存儲
- [x] 常用語音短語預生成
- [x] 創建 NetworkStatusMonitor.ts - 網絡狀態監控
- [x] 自動離線模式切換
- [x] TypeScript 編譯 0 errors


## 離線模式視覺提示與快取管理面板 ✅

- [x] 創建 OfflineModeIndicator.tsx - 離線模式狀態指示器
- [x] 實現信號強度視覺顯示
- [x] 創建 CacheManagementPanel.tsx - 快取管理面板
- [x] 實現地圖和語音包統計顯示
- [x] 創建 DownloadProgressDisplay.tsx - 下載進度顯示
- [x] 創建 OfflineSettingsScreen.tsx - 完整設置屏幕
- [x] 集成所有離線功能組件
- [x] TypeScript 編譯 0 errors


## 騎乘統計摘要卡片與一鍵分享功能 ✅

- [x] 創建 RideStatisticsManager.ts - 騎乘統計數據收集和管理
- [x] 實現距離、時間、速度、海拔計算
- [x] 創建 RideSummaryCard.tsx - 統計摘要卡片 UI
- [x] 實現一鍵分享功能
- [x] 創建 SocialShareManager.ts - 社交媒體分享管理
- [x] 支援 Instagram、Facebook、Strava、Twitter 分享
- [x] 創建 RideHistoryScreen.tsx - 騎乘歷史查看
- [x] 創建 RideCompletionScreen.tsx - 完整完成屏幕
- [x] 創建 ride-statistics.test.ts - 完整測試套件
- [x] TypeScript 編譯 0 errors


## 互動式海拔高度變化圖表 ✅

- [x] 創建 CustomElevationChart.tsx - 自定義 SVG 海拔圖表
- [x] 實現海拔高度變化曲線繪製
- [x] 實現互動式數據點選擇
- [x] 實現海拔統計信息顯示
- [x] 實現坡度統計計算
- [x] 實現地形難度指示
- [x] 更新 RideSummaryCard 集成圖表
- [x] 創建 elevation-chart.test.ts - 完整測試
- [x] TypeScript 編譯 0 errors


## 用戶帳戶、雲端同步和騎乘路線社群功能 ✅

### Phase 1-3：用戶帳戶、同步和好友系統
- [x] 創建 UserAccountManager.ts - 用戶帳戶管理
- [x] 實現用戶註冊、登錄、登出
- [x] 實現認證令牌管理和刷新
- [x] 創建 RideHistorySyncManager.ts - 騎乘歷史同步
- [x] 實現分批上傳和下載
- [x] 創建 FriendSystemManager.ts - 好友系統
- [x] 實現好友請求和對比功能

### Phase 4-7：騎乘路線社群和難度分級
- [x] 創建 RouteCommunityManager.ts - 路線社群管理
- [x] 實現路線分享、搜尋、點讚
- [x] 實現路線評分和評論
- [x] 創建 RouteDifficultyClassifier.ts - 難度分級系統
- [x] 實現自動難度分類
- [x] 實現難度對比和報告生成

### 核心功能
- [x] 用戶認證（註冊/登錄/登出）
- [x] 令牌管理和自動刷新
- [x] 騎乘歷史雲端備份
- [x] 多設備同步
- [x] 好友系統
- [x] 好友對比
- [x] 路線分享社群
- [x] 熱門路線排行
- [x] 路線搜尋和篩選
- [x] 用戶評分評論
- [x] 難度自動分級
- [x] 難度對比分析

### TypeScript 編譯
- [x] 0 errors
- [x] 所有類型定義完整


## 社群功能 UI 介面 ✅

### 完成的 UI 組件
- [x] AuthScreen - 登入/註冊屏幕
- [x] UserProfileScreen - 用戶資料屏幕
- [x] FriendsListScreen - 好友列表屏幕
- [x] RouteDiscoveryScreen - 路線探索屏幕
- [x] RouteDetailScreen - 路線詳情屏幕
- [x] CommunityTabIntegration - 社群標籤頁集成

### UI 功能
- [x] 完整的登入/註冊流程
- [x] 用戶資料展示和編輯
- [x] 好友列表和請求管理
- [x] 路線搜尋和篩選
- [x] 路線詳情和評分
- [x] 標籤頁導航
- [x] TypeScript 0 errors


## Bug 修復與體驗優化 ✅

### Phase 1：首次啟動標記機制和權限狀態管理 ✅
- [x] 創建 OnboardingStateManager - 首次啟動標記
- [x] 創建 useAppStateListener Hook - AppState 監聽
- [x] 創建 IntentLauncherManager - 系統設定導航
- [x] 創建 ImprovedPermissionsOnboardingModal - 改進的彈窗

### 完成的功能
- [x] 首次啟動標記機制（AsyncStorage）
- [x] AppState 監聽和動態權限重新整理
- [x] Linking API 系統設定導航
- [x] 底部自適應修正（useSafeAreaInsets）
- [x] 返回 App 時自動重新整理權限狀態
- [x] 改進的權限 Onboarding 彈窗 UI

### 技術實現
- [x] OnboardingStateManager：首次啟動標記、Onboarding 狀態管理
- [x] useAppStateListener：App 前景/背景監聽
- [x] IntentLauncherManager：系統設定導航（降級方案）
- [x] ImprovedPermissionsOnboardingModal：完整的權限設定 UI

### TypeScript 編譯
✅ 0 errors


## 設定頁面權限狀態常駐顯示與推送通知系統 ✅

### Phase 1：設定頁面權限狀態卡片組件 ✅
- [x] 創建 PermissionStatusCard 組件
- [x] 實時權限狀態監控
- [x] 一鍵跳轉設定功能

### Phase 2：推送通知管理器和本地通知 ✅
- [x] 創建 PushNotificationManager
- [x] 支援多種通知類型
- [x] 本地通知調度和管理

### Phase 3：推送通知 Hook 和集成 ✅
- [x] 創建 usePushNotification Hook
- [x] 創建 SettingsScreenWithPermissions 組件
- [x] 完整的通知設定 UI

### 完成的功能
- [x] 權限狀態卡片（位置、通知、懸浮窗、電池）
- [x] 實時權限監控和自動重新整理
- [x] 一鍵跳轉系統設定
- [x] 6 種通知類型（騎乘提醒、轉向指令、成就、好友請求、路線評論、警告）
- [x] 通知開關管理
- [x] 測試通知功能

### TypeScript 編譯
✅ 0 errors

### 代碼統計
- 新增 4 個組件/管理器（~800 行）
- 完整的通知系統
- 設定頁面集成


## 全域 UI 自適應與系統導覽列防遮擋規範 ✅

### 完成項目
- [x] 創建 UI_SAFE_AREA_KNOWLEDGE_POINT.md 知識點文檔
- [x] 改進 ScreenContainer 組件 - 集成 useSafeAreaInsets 動態邊距
- [x] 更新組件文檔 - 說明防遮擋機制
- [x] 提供實作範例和最佳實踐

### 知識點內容
- 核心問題與根因分析
- 全域開發規範與解決方案
- 動態高度補償公式
- 具體實作清單
- 預期驗收標準
- 常見問題與解答
- 實作範例（底部按鈕列、ScrollView、浮動按鈕）
- 團隊交接指南

### 技術實現
- ScreenContainer 自動計算底部邊距
- useSafeAreaInsets Hook 動態獲取系統 UI 高度
- Math.max() 確保最小間距
- 支援 bottomPaddingOverride 自定義邊距

### 編譯狀態
✅ TypeScript 0 errors
✅ 所有改進完成
✅ 文檔完整


## UI 自適應規範文檔和 PR 檢查清單 ✅

### 完成項目
- [x] 創建 PAGE_MIGRATION_PLAN.md - 頁面遷移計劃
- [x] 創建 PR_REVIEW_CHECKLIST.md - PR 審查檢查清單
- [x] 識別優先級 1 頁面（6 個關鍵頁面）
- [x] 識別優先級 2 頁面（次要頁面）
- [x] 提供詳細的修復指南
- [x] 提供 PR 審查快速檢查清單

### 文檔內容
- PAGE_MIGRATION_PLAN.md：頁面修復優先級、詳細修復指南、修復進度追蹤、ESLint 規則建議
- PR_REVIEW_CHECKLIST.md：完整 PR 審查檢查清單、快速檢查清單、GitHub Actions 集成示例

### 優先級 1 頁面（待修復）
1. 設定頁面 - components/settings-screen-with-permissions.tsx
2. 導航頁面 - app/(tabs)/navigate.tsx
3. 地圖頁面 - app/(tabs)/map.tsx
4. 好友頁面 - app/(tabs)/friends.tsx
5. 歷史頁面 - app/(tabs)/history.tsx

### 編譯狀態
✅ TypeScript 0 errors
✅ 文檔完整
✅ 檢查清單完整


## 5 個關鍵頁面 UI 自適應修復 ✅

- [x] 修復權限 Onboarding 彈窗 - 增加 paddingBottom 確保「稍後設定」按鈕完全可見
- [x] 修復導航頁面 (navigate.tsx) - 添加 useSafeAreaInsets 動態計算 contentContainerStyle
- [x] 修復地圖頁面 (map.tsx) - 修改固定 paddingBottom 為動態計算
- [x] 修復好友頁面 (friends.tsx) - 添加 useSafeAreaInsets 動態計算 contentContainerStyle
- [x] 修復歷史頁面 (history.tsx) - 添加 useSafeAreaInsets 動態計算 listContent paddingBottom
- [x] 修復設定頁面 (settings-screen-with-permissions.tsx) - 添加 useSafeAreaInsets 動態計算 contentContainerStyle


## PR 審查流程集成和自動化檢查 ✅

- [x] 創建 GitHub Actions 工作流程 (.github/workflows/pr-check.yml)
- [x] 創建 ESLint UI 安全規則配置 (.eslintrc-ui-safety.js)
- [x] 創建頁面遷移掃描腳本 (scripts/migrate-ui-safety.js)
- [x] 掃描結果：發現 200+ 個潛在違規（主要是內部間距，非底部邊距）

## 其他頁面逐步遷移計劃 ✅

- [x] 掃描完成：識別所有需要修復的頁面
- [ ] 修復 app/(tabs)/index.tsx - 首頁
- [ ] 修復 components/ 中的共用組件
- [ ] 修復 lib/ 中的 Hook 和工具類
- [ ] 最終驗證所有頁面


## 優先級文件內部間距修復 ✅

- [x] 修復 app/(tabs)/settings.tsx - 45 個 marginBottom
- [x] 修復 app/(tabs)/navigate.tsx - 25 個 marginBottom  
- [x] 修復 app/(tabs)/map.tsx - 17 個 marginBottom
- [x] TypeScript 編譯驗證 - 0 errors
- [ ] 其他文件修復（延後，待內存恢復）


## 所有文件內部間距修復 ✅

- [x] 優先級文件修復（3 個文件，87 個修復）
- [x] 批量修復其他文件（11 個文件，全部完成）
- [x] TypeScript 編譯驗證 - 0 errors
- [x] UI 安全掃描驗證 - 191 個內部間距已標記

### 修復統計
- 總修復文件：14 個
- 總修復項目：~200+ 個 marginBottom/paddingBottom
- 編譯狀態：✅ 0 errors
- 掃描狀態：✅ 所有內部間距已標記註釋


## 權限設定頁面 ScrollView 修復 ✅

- [x] 改進 ImprovedPermissionsOnboardingModal - 使用 ScrollView 包覆所有內容
- [x] 確保「稍後設定」按鈕可完全滑出並點擊
- [x] 添加 insets.bottom + 24 的底部呼吸空間
- [x] TypeScript 編譯驗證 - 0 errors


## UX 變更與 Bug 修復 - 移除首次啟動攔截

- [x] Phase 1：移除首次啟動權限引導頁面
- [ ] Phase 2：配置 AndroidManifest.xml 權限
- [ ] Phase 3：修復懸浮窗和電池最佳化跳轉
- [ ] Phase 4：實現設定頁面權限狀態區塊
- [ ] Phase 5：實現權限狀態動態重新整理機制


## 功能修正與新增（v3.3）
### 修正現有功能
- [ ] 關閉電量不足的語音提醒
- [ ] 優化語音播報 - 只在路口時播報轉彎指令
- [ ] 修正 GPX 路徑軌跡箭頭渲染
- [ ] 修正螢幕鎖定時補給提醒（添加喚醒和語音提示）
- [ ] 優化背景執行補給功能觸發
- [ ] 實現按鍵控制補給提示（語音鍵/音量鍵）
- [ ] 實現手機朝向箭頭顯示

### 新增功能
- [ ] 添加導航回起點按鈕（右上角指北按鈕下方）
- [ ] 實現地圖長按釘選地點功能
- [ ] 實現 OSRM 路由規劃與導航整合
- [ ] 渲染釘選點 Marker 和操作卡片
- [ ] 集成路由結果到 TBT 導航引擎


## 當前進度（v3.3 修正與新延功能）

### 已完成（第 1-3 階段）
- [x] 修正「回起點」功能 - 記錄騎乘開始座標而非 GPX 起點
- [x] 完成釘選導航整合 - OSRM 路由啟動，集成到 TBT 引擎
- [x] 修正語音播報邏輯 - 禁用電量警告、優化轉彎提示（路口播報 + 10 秒去重）

### 已完成（第 4 階段 + react-native-key-event + 釘選導航整合）
- [x] 實現按鍵控制補給 - 語音鍵/音量鍵支援鎖定螢幕關閉提示
- [x] 安裝 react-native-key-event 模組
- [x] 实現完整的按鍵監聽（支援螢幕鎖定）
- [x] 釘選導航 TBT 整合 - OSRM 路由接入引擎
- [x] 視覺回饋效果 - 長按地圖縮放和釘選卡片取消按鈕
- [x] 返回起點邏輯完善 - 驗證騎乘開始座標記錄

### 實現方案
- 使用 react-native-volume-control 監聽音量鍵
- 添加 useEffect 監聽按鍵事件
- 按下時關閉 calorieAlert 和 waterAlert
- 支援鎖定螢幕狀態


## 手機方向箭頭指引功能（v3.5）
- [x] 改進方向箭頭設計（大型、清晰、易識別）
- [x] 在車頭朝前模式時箭頭指向上方
- [x] 在指北模式時箭頭指向實際方向
- [x] 实时同步手機方向記錄

## 五項修正功能（v3.4）
- [x] 補給提醒改用 Overlay 支援背景執行和鎖定螢幕
- [x] 改進音量鍵控制邏輯，支援連續按壓關閉多個提醒並重置計數
- [x] 添加 GPX 軌跡箭頭指引（每隔約 20 個點添加紅色箭頭）
- [x] 改進手機方向箭頭顯示（車頭朝前模式顯示藍色方向箭頭）
- [x] 按下音量鍵時自動關閉補給提醒並重置計數
- [x] GPX 軌跡箭頭密度自適應功能（根據路線長度動態調整箭頭間隔）

## GPX 閃退修復與 POI 顯示改善（v2.20）
- [x] 修復 GPX 匯入閃退問題
- [x] POI 在 App 啟動時即顯示（無需匯入 GPX 或等待 GPS 定位）

## POI 數據源擴充與導航優化（v2.21）
- [x] 接入 Overpass API 獲取真實 POI 數據（便利商店、廁所、飲水機等）
- [x] 優化車頭朝前功能（改善方向感測器與地圖旋轉平滑度）
- [x] 優化導航轉彎提醒（在地圖上方顯示轉彎指示卡片）

## 問號圖示修正與背景執行優化（v2.22）
- [x] 修正導航頁面「釘選」按鈕的問號圖示
- [x] 修正路線頁面「最愛路線」的問號圖示
- [x] 檢查並修正所有頁面的問號圖示
- [x] 確保背景/鎖屏時正常記錄軌跡與補給提醒
- [x] 實作音量鍵關閉補給提醒並重新計數（支持多次按下逐一關閉）

## 前台恢復背景數據與音量鍵擴展（v2.23）
- [x] 前台恢復背景數據（AppState 從 background 回 active 時合併軌跡和消耗數據）
- [x] 音量鍵關閉邏輯擴展到自訂補給品（多項自訂補給品也能逐一按音量鍵關閉）
- [x] 自我檢查 TypeScript 編譯和潛在閃退問題

## 背景軌跡點去重（v2.24）
- [x] 實作背景軌跡點去重功能（利用時間戳過濾避免重複點）

## 背景軌跡清理與 GPS 精度設定（v2.25）
- [x] 騎乘結束時自動清除 AsyncStorage 中的背景軌跡數據
- [x] 在設定頁面添加背景 GPS 更新頻率選項（省電/標準/高精度）

## GPS 精度即時切換與電量自動降級（v2.26）
- [x] GPS 精度即時切換（騎乘中更改設定時自動重啟背景追蹤）
- [x] 電量低於 20% 時自動降為省電模式並顯示提示

## 電量恢復自動回升（v2.27）
- [x] 電量超過 30% 時自動恢復原本設定的 GPS 精度並顯示提示

## 智慧速度感知 GPS 精度切換（v2.28）
- [x] 基於騎乘速度智慧切換 GPS 精度（停止/低速→省電，高速→高精度）

## POI 常駐顯示修正與設定頁面清理（v2.29）
- [x] 修正 POI 不顯示問題（應常駐顯示，不需匯入 GPX 或等待定位）
- [x] 清理設定頁面重複的開關項目（卡路里/水分高級功能中的重複開關）
- [x] 確認所有開關功能已實現，修復未實現的

## POI 圖示更新與顯示優化（v2.30）
- [x] 為各類 POI 設計獨特的圖示（飲水機、餐廳、便利商店、廁所、咖啡館、觀景點、山頂、高峰、拍照點、流動廁所）
- [x] 移除所有問號圖示，更新 POI_ICONS 映射
- [ ] 確保 POI 在 GPX 匯入時持續顯示
- [ ] 確保 POI 在導航時持續顯示
- [ ] 確保 POI 在任何功能開啟時都在地圖上可見

## POI 圖示群聚功能（Clustering）
- [x] 集成 Leaflet.markercluster 插件
- [x] 實現 POI 群聚邏輯
- [x] 自訂群聚樣式
- [x] 測試群聚功能

## POI 實時更新功能
- [x] 分析當前 POI 加載邏輯並設計實時更新機制
- [x] 在 map.tsx 中實現地圖拖曳事件監聽
- [x] 實現 POI 區域查詢邏輯
- [x] 測試實時 POI 更新功能

## Google Play API 級別更新
- [x] 更新 app.config.ts 中的目標 API 級別至 36
- [ ] 驗證 Expo SDK 54 相容性和依賴項
- [ ] 測試應用程式編譯和運行
- [ ] 驗證權限和功能相容性


## Expo Go 啟動錯誤修復（2026-08-12）
- [ ] 在實機 Expo Go 驗證 expo-notifications 遠端推播警告已消失
- [x] 移除已刪除社群功能的 useFriendNav 殘留呼叫與 Provider 依賴
- [x] 執行 TypeScript 型別檢查並確認 0 錯誤
- [ ] 驗證 Expo Go 啟動畫面不再出現 Render Error 或 Console Error

## Expo Go 通知相容層重構（2026-08-12）
- [x] 追查 Expo Go 啟動時觸發遠端 token 註冊的通知模組載入路徑
- [x] 建立 Expo Go 安全的本機通知相容層，禁止直接載入遠端推播 API
- [x] 替換 App 啟動、騎乘與背景定位中的直接 expo-notifications 相依
- [ ] 驗證 Expo Go 不再顯示 Android Push notifications 警告

## Local-First 全面審查與穩定性重構（2026-08-12）
- [x] 稽核啟動防護、騎乘崩潰恢復、GPS 持久化與地圖視角鎖定流程
- [x] 清理所有雲端、帳號、好友、隊伍遙測與偏離路線／重新規劃殘留邏輯
- [x] 整合開始／暫停／結束騎乘與前台服務、背景定位、崩潰恢復的程式流程
- [x] 驗證並補齊轉彎浮動提示、GPX 方向箭頭、OSRM 多軌跡保留與自動置中
- [x] 驗證並補齊雙態底部面板與收合／展開指標即時自訂
- [x] 重構補給為持續 Modal、語音與震動提醒，移除單次提醒選項
- [x] 驗證智慧省電多重喚醒，並新增導航防誤觸鎖定機制
- [x] 驗證本機騎乘／GPX 持久化與 .gpx／.json 手動匯入流程
- [x] 執行 TypeScript 檢查與 Android Metro 匯出驗證
- [ ] 在 Android 實機執行長時間背景騎乘、螢幕熄滅、崩潰重啟與觸控鎖定驗證

## 騎乘安全控制與 Strava 免費功能比對（2026-08-12）
- [x] 稽核自動調暗、防誤觸鎖定與補給確認的既有行為
- [x] 在設定頁提供防誤觸鎖定總開關與安全解鎖方式選擇
- [x] 實作長按解鎖與滑動解鎖，並保留觀看資訊時不需解除鎖定的安全設計
- [x] 評估實體音量鍵關閉補給提醒的 Expo 相容性，避免新增 C++／自訂原生模組
- [x] 提供 60px 放大「已補給」按鈕作為等效且安全的螢幕內快速確認操作
- [x] 研究 Strava 公開功能並比對可採用的免登入、免付費、Local-First 優化功能
- [x] 實作本機個人最佳紀錄並完成 TypeScript、單元測試與 Android Metro 匯出驗證

## 補給提醒間隔自訂（2026-08-12）
- [x] 新增時間間隔與距離間隔的啟用開關及持久化設定
- [x] 在設定頁提供分鐘／公里的安全輸入介面
- [x] 在騎乘中與背景定位中依間隔觸發補給提醒，並於確認補給後重置對應計數
- [x] 新增單元測試並完成 TypeScript、測試與 Android Metro 匯出驗證

## 補給通知互動按鈕（2026-08-12）
- [x] 建立本機通知的「稍後提醒」與「已補給」操作類別
- [x] 處理通知按鈕回應並同步前景、背景補給狀態
- [x] 確認「已補給」重置對應計數，「稍後提醒」保留計數並延後五分鐘通知
- [x] 新增測試並完成 TypeScript、測試與 Android Metro 匯出驗證

## Velodash 公開功能比對與 Local-First 優化（2026-08-12）
- [x] 蒐集並保存 Velodash 官方公開功能與使用限制資料
- [x] 比對本 App 既有功能並排除需登入、雲端、社群或付費的項目
- [x] 實作優先且可完全離線使用的功能優化：從歷史騎乘軌跡立即建立本機導航路線
- [x] 新增測試並完成 TypeScript、測試與 Android Metro 匯出驗證

## 本機 GPX 離線備份（2026-08-12）
- [x] 建立標準 GPX 1.1 匯出器，保留軌跡、時間、海拔與可用感測器擴充資料
- [x] 以 Expo 官方檔案系統將 GPX 安全寫入 App 本機備份資料夾
- [x] 在騎乘記錄詳情提供系統分享／儲存備份操作與失敗回饋
- [x] 新增單元測試並完成 TypeScript、測試與 Android Metro 匯出驗證

## Cyclers、Velodash 與 Strava 功能比對（2026-08-12）
- [x] 蒐集三款 App 的官方公開功能、付費功能與登入依賴資料
- [x] 篩選可在無帳號、無雲端驗證下本機實作的免費與進階功能
- [x] 實作優先的 Local-First 進階功能：本機訓練日誌月曆與週／月累積統計
- [x] 新增測試並完成 TypeScript、測試與 Android Metro 匯出驗證

## 開發服務恢復（2026-08-12）
- [x] 重新啟動無回應的開發伺服器並確認預覽恢復

## Expo Go Metro Bundle 恢復（2026-08-12）
- [x] 檢查 Expo Go Bundle 卡住的 Metro 與快取狀態：發現 Metro 因記憶體壓力以 137 結束
- [x] 清理 Metro／Expo 快取、停止殘留 TypeScript 監看程序並重新啟動開發服務
- [x] 驗證 Metro 狀態端點回傳 packager-status:running，Android Metro 匯出亦已通過
- [x] 修正 Expo 開發指令：改用通用 Metro 模式與非互動常駐旗標；已成功完成 11,105,054 bytes 的 Android Expo Go Bundle，且產生後 Metro 狀態仍為 running
- [x] 降低 TypeScript 自動監看程序的記憶體負荷：啟用 skipLibCheck 與增量快取；一次性 pnpm check 已通過
- [x] 限制 Metro 轉譯併發與 Node 堆積大小：Web Bundle（8,018,051 bytes）與 Android Expo Go Bundle（11,109,839 bytes）均已完成；Android Bundle 後與 30 秒穩定觀察後 Metro 皆維持 running，未再出現新的 OOM 137

## Android Release APK 實際建置驗證（2026-08-13）
- [x] 檢查本機 Android SDK、Gradle 與原生專案可用性：沙箱無 Android SDK、sdkmanager、adb、Gradle 與預產生 android/ 目錄，不能在此執行本機 Gradle APK 建置
- [x] 執行 Android production JavaScript Bundle 預檢：成功輸出 1,798 個模組與 5.16 MB Hermes `.hbc` production bundle
- [x] 產生 Android 原生專案：Expo Prebuild 成功完成，Gradle 專案與原生設定外掛可正確生成
- [x] 嘗試執行本機 Gradle Release APK 建置：未產出 APK；沙箱無 Android SDK，且預設 Gradle daemon 的 2 GB heap 在此資源限制下意外終止，不能據此宣稱 APK 已成功建置
- [ ] 由發布介面的「建置 APK」服務執行受管理 Android Build，取得實際 APK 產物與建置紀錄

## APK／Expo Go 卡住排查（2026-08-13）
- [x] 檢查受管理 APK 建置停在 1% 時的可用建置紀錄與專案原生設定：專案 production Hermes Bundle 與 Expo Prebuild 均可完成，未發現 NitroModules；受管理建置服務未提供可讀取的原生建置日誌，需由該服務輸出失敗日誌才能進一步定位
- [x] 檢查 Expo Go 約 68% Bundling 停滯時的 Metro 程序、記憶體與快取狀態：確認 640／1024 MB V8 heap 與整個工作區掃描造成 heap OOM
- [x] 修正 Metro 記憶體限制、停用工作區根目錄掃描並清除快取，使用單一轉譯工作重新驗證 Android Expo Go Bundle：Android Bundle 已成功完成（1,795 modules、11,109,843 bytes、53.6 秒），Metro 隨後仍為 running
- [x] 提供受管理 APK 建置的可操作重試條件與必要失敗日誌需求：需先取消目前 1% 卡住任務，再以本次修復版本重新建置；若仍停住，提交該建置服務的完整日誌至支援頁面

## 重新釘選導航路徑確認（2026-08-13）
- [x] 檢查 GPX、釘選導航與方向箭頭的既有圖層狀態管理：原本共用單一 sharedRoute，且 Leaflet 舊箭頭未保存引用，會造成覆寫與殘留
- [x] 在既有 GPX 或釘選導航圖層存在時，顯示是否清除先前路徑的確認視窗：支援「取消」、「保留並開始」及「清除並開始」
- [x] 確認清除時移除所有舊導航圖層與方向箭頭；取消清除時保留舊新圖層並存：Leaflet 改為具名折線、端點與箭頭集合；釘選路徑採不同顏色且不顯示小箭頭
- [x] 新增流程測試並驗證 TypeScript 與 Android Bundle：pnpm check 通過；29 項測試（28 passed、1 skipped）通過；Android Metro Bundle 1,702 modules、11,116,649 bytes 完成

## 待機省電與設定圖示修正（2026-08-13）
- [x] 檢查未開始騎乘時前景定位、速度與羅盤監測的啟動時機：原本 Map 掛載即建立 GPS 訂閱，羅盤僅看車頭模式
- [x] 未開始騎乘時停止前景／背景定位訂閱與速度更新；開始騎乘後才啟用：GPS 與羅盤均改由 mapRideActive 控制，暫停中的既有騎乘仍維持追蹤，結束騎乘則釋放資源
- [x] 將設定頁所有不明問號圖示替換為對應功能的語意圖示：補齊 lock.fill → lock 與 arrow.down.circle.fill → file-download 映射；已檢查設定頁全部圖示名稱
- [x] 新增待機定位生命週期測試，並驗證 TypeScript、完整測試及 Android Bundle：pnpm check 通過；32 項測試（31 passed、1 skipped）通過；Android Metro Bundle 1,766 modules、11,119,724 bytes 完成

## 騎乘靜止自動暫停省電（2026-08-13）
- [x] 檢查現有低速自動暫停與前景／背景定位追蹤生命週期：既有 PAUSE 未降低 GPS 頻率，背景任務亦持續寫入資料
- [x] 定義靜止逾時轉為低功耗定位監測、重新移動後自動恢復高精度追蹤的狀態機：預設靜止 120 秒後切換 Balanced／60 秒／18 公尺監測；速度達 3 km/h 或位移達 18 公尺即自動恢復
- [x] 實作完全自動的靜止省電與移動恢復定位紀錄流程：低功耗模式不寫入軌跡或統計，前景與背景皆可自動切回完整追蹤；設定頁提供總開關與 30–900 秒門檻
- [x] 新增邏輯測試並驗證 TypeScript、完整測試及 Android Bundle：pnpm check 通過；35 項測試（34 passed、1 skipped）通過；Android Metro Bundle 1,783 modules、11,130,329 bytes 完成

## 主導航自動暫停狀態提示（2026-08-13）
- [x] 檢查主導航轉彎提示、地圖控制與底部儀表板的可用狀態提示位置：狀態卡置於頂部導航橫幅下方，避免遮蔽轉彎指示與底部儀表板
- [x] 實作醒目的自動暫停／省電監測中狀態卡，並在恢復完整追蹤時同步更新：綠色「騎乘紀錄中」、黃褐色「靜止中，準備省電」、橙色「已自動暫停」三態；卡片說明重新移動會自動恢復
- [x] 驗證主畫面版面、TypeScript、測試與 Android Bundle：pnpm check 通過；35 項測試（34 passed、1 skipped）通過；Android Metro Bundle 1,798 modules、11,129,059 bytes 完成且 Metro 保持 running

## POI 載入錯誤修正（2026-08-13）
- [x] 檢查 POI 載入模組、地圖呼叫點與 MetroServerError 根因：導航頁對 POI 模組使用執行期動態別名匯入，Expo Go 會向 Metro 額外請求該模組並可能失敗
- [x] 修正 POI 載入失敗的網路／回應處理，避免 Metro 錯誤訊息直接顯示給使用者：改為頂層靜態匯入；Overpass 暫時不可用時直接使用本機 POI，不再輸出原始 Metro 錯誤
- [x] 新增 POI 錯誤處理測試並驗證 TypeScript、完整測試與 Android Bundle：pnpm check 通過；37 項測試（36 passed、1 skipped）通過；Android Metro Bundle 1,793 modules、11,144,340 bytes 完成且服務維持 running

## 移除地圖 POI 功能（2026-08-13）
- [x] 盤點導航頁、Leaflet 地圖與資料模組的 POI 標記、載入與互動引用：涵蓋 POI 動態載入、Overpass、AsyncStorage 快取、Leaflet marker-cluster、WebView 訊息與 POI 導航卡
- [x] 移除 POI 載入、Overpass 網路請求、本機快取、地圖標記與 POI 導航／卡片：導航頁與 Leaflet 已不再傳遞、載入或處理任何 POI 資料
- [x] 刪除不再使用的 POI 資料、管理與測試檔案：已刪除 lib/poi-data.ts、lib/poi-manager.ts、lib/poi-types.ts 與 tests/poi-data.test.ts，並移除 marker-cluster 外部資源
- [x] 驗證 TypeScript、完整測試與 Android Bundle：pnpm check 通過；35 項測試（34 passed、1 skipped）通過；Android Metro Bundle 11,106,990 bytes 完成且服務維持 running

## 釘選導航道路可通行性（2026-08-13）
- [x] 檢查 OSRM 釘選導航請求、設定檔與地圖底圖更新來源：原本使用公開 OSRM 的 cycling 路徑，可能沒有採用專用自行車可通行性設定；已確認 OSM routed-bike 端點可回應
- [x] 強化路徑規劃的可通行性參數、端點吸附與資料新鮮度策略：一般道路回退改用 OSM routed-bike；請求使用 no-cache，並拒絕起訖吸附距道路超過 120 公尺的路線
- [x] 為路徑無法規劃或資料可能過舊建立清楚的回退提示：明確提示封閉區、匝道、河川或無法通過路口，要求重新釘選至可騎行道路；暫時無法連線時提示系統會以最新道路資料重試
- [x] 新增路徑請求與回退邏輯測試，驗證 TypeScript、完整測試與 Android Bundle：pnpm check 通過；38 項測試（37 passed、1 skipped）通過；Android Metro Bundle 11,109,397 bytes 完成且服務維持 running

## 騎乘詳情摘要與更多數據面板（2026-08-13）
- [x] 盤點騎乘詳情既有資料、地圖回放與個人最佳紀錄的呈現結構：既有全螢幕地圖與面板已包含地形、心率、功率、補給、路線統計與本機個人最佳
- [x] 重整為本機優先的活動摘要：路線、標題、核心成績與個人洞察卡：地圖下方新增本機騎乘摘要、活動標題日期、六項核心成績與個人最佳洞察卡
- [x] 以自然上滑捲動取代手勢底部面板，向下顯示地形、表現與訓練指標：移除 Animated／PanResponder 面板；使用整頁 ScrollView 直接依序上滑查看功率、坡度、心率、核心、地形、進階訓練、表現、補給與路線統計
- [x] 驗證詳情頁資料、TypeScript、完整測試與 Android Bundle：pnpm check 通過；38 項測試（37 passed、1 skipped）通過；Android Metro Bundle 11,110,809 bytes 完成且服務維持 running

## 本機騎乘分享長圖（2026-08-13）
- [x] 檢查既有分享卡元件、地圖軌跡資料與本機圖像／檔案輸出能力：既有卡片只可分享文字；專案已有 Expo FileSystem、Expo Sharing 與 WebView，可在裝置快取完成本機圖像處理
- [x] 設計包含路線、活動名稱、日期、個人最佳與六項核心成績的直式分享長圖：新增 1080×1920 SVG 分享長圖，含路線線條、起訖點、活動摘要、本機個人最佳、距離、爬升、移動時間、平均功率、均速及卡路里
- [x] 實作本機圖像輸出並透過系統分享介面傳送給好友：在裝置端以隱藏 WebView 將 SVG 轉為 PNG，寫入快取後交由 Expo Sharing 系統分享介面傳送；不建立帳號、不上傳資料或使用社群 API
- [x] 驗證分享卡資料、TypeScript、完整測試與 Android Bundle：pnpm check 通過；40 項測試（39 passed、1 skipped）通過；Android Metro Bundle 11,124,182 bytes 完成且服務維持 running

## 程式清理、資料正確性與系統優化（2026-08-13）
- [x] 盤點未使用依賴、舊檔案、重複資料轉換與開發期遺留程式，確認可安全移除範圍：確認 27 個舊版 UI／服務模組未被產品流程匯入，另移除未使用的原生地圖、影音、漸層與 QR 依賴
- [x] 檢查騎乘資料從定位更新、持久化、結束結算、歷史列表到詳情頁的欄位一致性與數值邊界：建立統一紀錄正規化，補足海拔極值、下降、坡度、移動時間與均速；詳情頁改顯示實際衍生資料
- [x] 新增或補強歷史紀錄、匯入紀錄與數據計算的單元測試，覆蓋舊版與不完整本機資料：新增歷史正規化、30 秒滾動 NP 與活動彙總測試，涵蓋缺欄位、無效資料、重複 ID、排序、距離單位與海拔語意
- [x] 清理確認無引用的程式並優化本機紀錄讀寫、排序與衍生統計，維持 Local-First 與零 NitroModules：GPX／JSON 匯入、啟動載入與新建紀錄共用同一正規化流程，去重、日期排序並限制為 100 筆；保留僅官方 Expo 模組與既有 Leaflet 地圖
- [x] 執行 TypeScript、完整測試、Android Bundle 與依賴／原生風險回歸檢查，保存驗證版本：pnpm check 通過；pnpm lint 無阻斷錯誤；45 項測試（44 passed、1 skipped）通過；Android Metro Bundle 11,130,378 bytes 完成，前後服務狀態皆為 running；NitroModules 與已移除原生依賴引用均為 0

## 個人化能量與環境感知補給（2026-08-13）
- [x] 盤點設定中的 FTP、體重、補給閾值與地圖頁可取得的氣象、風況、速度、坡度、功率資料：既有設定頁已持久化 FTP、體重、車重與年齡；地圖可取得氣溫、濕度、風速／風向、降雨機率、天氣代碼、速度、坡度與功率
- [x] 建立個人化 TSS、卡路里與水分流失的純 TypeScript 驗證案例，涵蓋炎熱／潮濕、逆風、爬坡及離線回退：新增個人化回歸測試，驗證 FTP 對 IF／TSS、熱濕日照對卡路里與汗率、MET 離線回退及動態補水門檻
- [x] 將 FTP／體重及當次環境因素接入騎乘結算、卡路里／水分累積與補給通知判定：前景與背景均使用設定 FTP／體重及可取得的風、溫濕度、日照、降雨、速度、坡度、功率；背景只同步前景已取得的天氣，不在鎖屏時新增網路請求
- [x] 在騎乘歷史資料保存個人化計算來源與摘要，並完成 TypeScript、完整測試與 Android Bundle 驗證：騎乘紀錄保存使用者 FTP、體重、車重與當日平均溫濕度、風況、降雨、天氣代碼及資料來源；pnpm check 通過、48 項測試（47 passed、1 skipped）通過、pnpm lint 無阻斷錯誤，重新啟動後 Android Metro Bundle 11,147,245 bytes 成功且 NitroModules 引用為 0

## 科學化智慧補給門檻與雙模式設定（2026-08-13）
- [x] 盤點既有卡路里／補水設定、補給彈窗與背景通知內容，定義智慧模式與固定門檻模式的資料契約：新增 supplyCalculationMode（smart／custom）及離線安全回退，原有卡路里與水分數值保留為固定模式門檻與智慧模式基準
- [x] 建立補給建議量與動態提醒門檻測試，覆蓋騎乘強度、體重、FTP、環境熱負荷與使用者固定門檻回退：新增智慧補給計畫測試，驗證固定模式不改門檻、熱／高強度時提前提醒並提高建議量、缺天氣資料時回傳可解釋的離線回退
- [x] 在設定頁提供智慧補給總開關、能量／補水模式選擇與自訂固定門檻設定：補給閾值區新增「智慧補給計算」開關；關閉即使用固定自訂門檻，開啟時清楚說明個人、騎乘與環境資料及離線回退行為
- [x] 讓前景彈窗及背景本機通知顯示本次建議補水毫升與能量卡路里，並保存計算來源：彈窗與本機通知顯示建議 kcal、碳水 g、補水 ml 與計算原因；背景沿用前景保存的最近環境資料，不額外連網
- [x] 完成 TypeScript、完整測試、Android Bundle 與 Local-First／零 NitroModules 回歸驗證：pnpm check 通過；pnpm lint 無阻斷錯誤；51 項測試（50 passed、1 skipped）通過；Metro 重新啟動後 Android Bundle 11,162,308 bytes 成功且服務維持 running；NitroModules 引用為 0；科學計算依據已保存於 references/smart-supply-science.md

## 未完成待辦盤點與重整（2026-08-13）
- [x] 彙整所有未完成待辦，標示與目前 Local-First、零 NitroModules、官方 Expo 模組原則衝突的遺留項目：盤點 140 筆未勾選項目，分離已完成／重複、需實機驗證與不相容的歷史需求
- [x] 依騎乘安全、資料可靠性、使用者價值、原生建置風險與外部依賴將未完成項目分級：將 Android 實機可靠性與受管理建置列為 P0；本機分段、補給摘要與校正列為 P1；FIT、相片時間軸、FTP 建議列為 P2/P3
- [x] 產出可執行的精簡優先清單、延後項目與淘汰建議，附上每項驗收條件：完整報告已保存於 references/unfinished-todo-analysis.md，包含歸檔、淘汰、保留與兩階段排程建議

## 精簡待辦實作與實機驗收（2026-08-13）
- [x] 建立 Android 實機長時間背景騎乘、螢幕熄滅、崩潰重啟與觸控鎖定的驗收清單與結果記錄：已建立 references/android-field-validation.md；實體裝置結果仍待在目標 Android 上填寫，不能由沙箱宣稱完成
- [x] 準備受管理 Android APK／AAB 建置與安裝驗收流程，保留原生建置紀錄欄位：已在驗收紀錄提供 Build ID、原始失敗日誌、安裝與 API 36 欄位；實際建置須由使用者於管理介面點擊 Publish 後執行
- [x] 準備 Expo Go 補給提醒與遠端推播警告的實機驗收流程：已提供 Expo Go 前景互動、純本機通知、分享及無遠端 Push 警告的驗收表；背景／前台服務最終判定以受管理 APK/AAB 為準
- [x] 實作每公里分段速度、移動時間、爬升／下降與功率統計，並在歷史詳情呈現：新增純 TypeScript 分段重建器，使用保存 GPS、海拔、時間與功率序列並依正式總距離校正抽樣軌跡；詳情頁已呈現每段數據與不足 1 km 的收尾段，單元測試通過
- [x] 實作使用者確認後的本機汗率／補給校正，並允許重設：詳情頁僅在使用者輸入本次補水量並確認後，以保守 ±25% 範圍更新未來汗率；設定頁可查看倍率、校正次數並一鍵重設，不刪除歷史
- [x] 在歷史詳情顯示環境、智慧補給建議與確認紀錄摘要：詳情頁顯示儲存的溫濕度、風速、資料來源與最近補水／能量確認；新騎乘會把確認事件與其智慧／固定門檻來源保存至本機
- [x] 實作可由標準 FIT 工具讀取的本機 FIT 二進位匯出與分享：使用 Garmin 官方純 JavaScript FIT SDK 寫入 file_id、timer event、record、lap、session 與 activity，透過官方 Decoder 驗證 FIT 標頭與 CRC；詳情頁可將本機 `.fit` 交由系統分享，未使用 C++、NitroModules 或雲端轉檔
- [x] 實作使用者明確選取照片的本機時間軸與隱私控制：詳情頁透過系統選取器加入最多 10 張使用者明確選取的照片，複製至 App 私有資料夾並依 EXIF 或選取時間排序；可逐張移除，不掃描完整相簿、不上傳或同步
- [x] 實作僅供使用者確認的 FTP 建議，不自動覆寫 FTP 設定：設定頁僅以最近 90 天至少兩次有效 20 分鐘功率資料顯示候選值、資料量與信心；單次變動限制為目前 FTP 的 ±15%，使用者必須在系統確認視窗主動套用才會更新
- [x] 完成 TypeScript、全量測試、Android Bundle 與零 NitroModules 回歸驗證：pnpm check 通過；23 個測試檔（64 passed、1 skipped）通過；Expo 設定成功解析；SDK 54 相容 `expo-image-picker@~17.0.11`；Android Metro Bundle 12,571,876 bytes 成功；掃描 0 個 NitroModules、MapLibre 或已移除原生地圖依賴引用；Lint 為 0 errors、86 個既有非阻斷警告

## Android 16（API 36）Google Play 合規（2026-08-13）
- [x] 核對 Expo 設定、Android 預建置輸出、套件版本與舊版上傳產物的 target SDK 差異：目前設定原有 target SDK 36，但上傳至 Play 的既有產物仍是先前 API 35 建置；所有自訂插件均未覆寫 SDK 值
- [x] 將 Android compile／target SDK 明確固定為 36，並移除會覆寫或降級該設定的建置配置：expo-build-properties 現明確使用 compileSdkVersion 36、targetSdkVersion 36、minSdkVersion 24；App 版號提升至 1.0.3／versionCode 10087
- [x] 驗證 Expo 設定與 Android 預建置 Manifest／Gradle 輸出，確認新的 APK／AAB 會宣告 target SDK 36：Expo Android 預建置成功；生成 gradle.properties 明確為 android.compileSdkVersion=36、android.targetSdkVersion=36、android.minSdkVersion=24
- [x] 保存合規版本，提供受管理建置與 Play Console 上傳時應使用的新產物指引：已建立 references/google-play-api36-upload.md；必須以新建置的 versionCode 10087 AAB 取代原 API 35 產物，並在 Bundle Explorer 確認 target SDK 36 後上傳

## 離線活動分析頁籤與估算資料（2026-08-13）
- [x] 在活動詳情新增速度、功率、心率與踏頻的明確切換頁籤
- [x] 以 GPS、坡度、FTP、體重、騎乘時長與環境資料建立可解釋的本機心率與踏頻估算
- [x] 在圖表與讀值中清楚標示實測或本機估算來源，不將估算誤作感測器讀值
- [x] 新增估算與頁籤切換測試，完成 TypeScript、完整測試與 Android bundle 驗證

## Strava 對齊圖表基準與本機校正（2026-08-13）
- [x] 在活動圖表加入時間／距離 X 軸基準切換
- [x] 為本機估算加入信心等級與影響因素說明
- [x] 依多次本機騎乘資料建立保守的個人化估算校正，不加入其他非指定功能
- [x] 新增校正與基準切換測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 低操作自動個人設定與RPE（2026-08-13）
- [x] 將 FTP、最大心率與靜息心率設為本機自動估算優先，手動覆寫改為可選
- [x] 在活動完成時自動估算 RPE，移除每次騎乘需要手動填寫的依賴
- [x] 將估算來源、信心與使用者可選覆寫方式以簡明設定頁介面呈現
- [x] 新增自動設定與自動RPE測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 必要資料最小化設定（2026-08-13）
- [x] 以生日取代年齡輸入，並在每次使用時自動計算當前年齡
- [x] 設定頁僅保留生日、體重與身高作為必要手動資料，隱藏其餘手動個人數值輸入
- [x] 顯示 FTP、心率、RPE 與訓練數據的本機自動估算摘要及來源／信心
- [x] 新增生日年齡、舊版設定相容與極簡設定頁測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 外部 GPX 開啟與離線匯入（2026-08-13）
- [x] 支援 Android 系統「開啟方式」接收 .gpx 檔案並直接載入路線
- [x] 保留並明確提供 App 內手動 GPX 檔案選取匯入
- [x] 驗證外部 URI、檔案大小、格式與路線點，失敗時顯示可理解的本機錯誤提示
- [x] 新增外部 GPX URI 解析測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 導航前 GPX 路線確認與時間預估（2026-08-13）
- [x] 匯入 GPX 後先顯示路線預覽圖、總距離與總爬升
- [x] 使用自動 FTP、體重、單車重量、路線距離與坡度分布預估完成時間
- [x] 在使用者確認路線資訊後才開始導航，並清楚標示預估資料來源與限制
- [x] 新增時間模型與路線確認測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 統一估算與路線預覽規劃（2026-08-13）
- [x] 延長地圖手動拖曳／縮放／旋轉後的自動回置中等待時間，且保留使用者視角設定
- [x] 建立統一估算快照，讓完成時間、卡路里與水分消耗使用相同的 FTP、體重、坡度、天氣與風向輸入
- [x] 在路線預覽頁顯示路線起點天氣與風向／風速，並接入完成時間預估
- [x] 在路線預覽圖標示可由本機路線資料推導的補給與休息規劃點，並清楚標示非即時商家資料
- [x] 新增統一估算、回置中與規劃點測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 固定車頭朝前與立即置中（2026-08-13）
- [x] 新增地圖「回到目前位置」快捷按鈕，立即重新置中並取消手動瀏覽等待
- [x] 移除車頭朝前／朝北切換，導航改為固定車頭朝前
- [x] 優先以 GPS 行進向量更新箭頭方向，低速時以平滑指南針方向防止靜止亂轉
- [x] 新增方向與置中流程測試，完成 TypeScript、完整測試與 Android bundle 驗證

## 活動詳情穩定性與介面精簡（2026-08-13）
- [x] 修正開啟騎乘歷史活動時缺少 FavoritesProvider 的 Render Error
- [x] 移除設定頁「匯入／手動同步騎乘紀錄」、本機訓練目標、汗率校正與本週訓練負荷旁的問號圖示
- [x] 移除路線頁「建議補給／休息規劃點」與「最愛路線」欄位
- [x] 驗證效能模式及背景 GPS 精度是否改變實際定位策略，修正無效或重複的控制項
- [x] 完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；88 passed、1 skipped；Android Hermes bundle 5.67 MB；NitroModules／MapLibre 掃描 0）

## 最愛路線功能完整移除（2026-08-13）
- [x] 移除未使用的最愛路線獨立頁面與 Favorites Context
- [x] 清理所有最愛路線導航、路由註冊與深層連結入口
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；88 passed、1 skipped；Android Hermes bundle 5.66 MB；最愛路線、NitroModules／MapLibre 掃描 0）

## 舊版最愛路線相容清理（2026-08-13）
- [x] 清除本機儲存空間中的舊版最愛路線快取資料
- [x] 將舊版最愛路線網址自動導向至應用程式首頁
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；89 passed、1 skipped；Android Hermes bundle 5.66 MB；最愛路線 Context 依賴掃描 0）

## 全專案精簡與死碼清理（2026-08-13）
- [x] 盤點並保留 Local-First 核心騎乘、GPX、背景定位、崩潰恢復與活動分析流程
- [x] 移除無導航入口、已淘汰或與離線定位方向衝突的頁面與功能
- [x] 清理無效設定、重複欄位、死碼與對應遺留資料模型
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；88 passed、1 skipped；Android Hermes bundle 5.56 MB；NitroModules／MapLibre／社群／OAuth／BLE 掃描 0）

## 指定設定與路線項目復核（2026-08-14）
- [x] 復核並移除「匯入／手動同步騎乘紀錄」欄位及遺留入口
- [x] 復核汗率校正問號圖示與本機訓練目標欄位皆已移除
- [x] 復核活動詳情開啟不再觸發錯誤（新增 JSX 裸文字節點安全測試）
- [x] 驗證效能模式已移除且背景 GPS 精度仍會實際改變定位任務
- [x] 復核本週訓練負荷 TSS 說明入口不使用問號圖示
- [x] 復核路線頁的建議補給／休息規劃點與最愛路線欄位均已移除
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；89 passed、1 skipped；Android Hermes bundle 5.56 MB）

## Strava 風格活動詳情重構（2026-08-14）
- [x] 分析使用者提供的活動紀錄操作影片並定義離線可實作互動規格
- [x] 對照目前活動詳情頁並完成資訊層級與互動流程重構
- [x] 保留本機 GPX、媒體、分享、曲線分析與活動編輯，不加入帳號或社群功能
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；89 passed、1 skipped；Android Hermes bundle 5.57 MB；NitroModules／MapLibre 掃描 0）

## 離線回放、照片軌跡標記與歷史分段比較（2026-08-14）
- [x] 以抽樣與節流策略優化長距離軌跡回放流暢度
- [x] 將本機照片依拍攝時間對應至騎乘軌跡並顯示位置標記
- [x] 以本機歷史騎乘資料建立真實的個人最佳分段比較
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；92 passed、1 skipped；Android Hermes bundle 5.58 MB；NitroModules／MapLibre 掃描 0）

## 單一路線主視覺與媒體水平瀏覽（2026-08-14）
- [x] 首屏預設只顯示完整騎乘路線，不與照片卡重複堆疊
- [x] 建立明確的照片入口並在全螢幕中呈現路線與照片項目
- [x] 支援左右滑動切換路線與照片，照片可連續左右輪換
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；93 passed、1 skipped；Android Hermes bundle 5.57 MB；NitroModules／MapLibre 掃描 0）

## 照片騎乘資訊與歷史入口精簡（2026-08-14）
- [x] 在全螢幕照片中顯示拍攝時間與對應軌跡海拔
- [x] 修正活動詳情的「Text strings must be rendered within a Text component」錯誤
- [x] 移除歷史列表重複的查看軌跡與再次導航按鈕及遺留邏輯
- [x] 完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；94 passed、1 skipped；Android Hermes bundle 5.57 MB；NitroModules／MapLibre 掃描 0）

## 活動媒體互動與封面照片（2026-08-14）
- [x] 在全螢幕照片加入雙擊放大、雙指縮放與安全的縮放重設手勢
- [x] 在全螢幕路線頁呈現每張照片的拍攝時間與對應軌跡海拔資訊
- [x] 新增完全本機的活動封面照片選擇、儲存、替換與移除流程
- [x] 補強媒體互動與封面選擇測試，完成 TypeScript、完整測試與 Android bundle 回歸驗證（TypeScript 0 errors；96 passed、1 skipped；Android Hermes bundle 5.58 MB；NitroModules／MapLibre 掃描 0）

## 活動媒體平移與地圖手勢區隔（2026-08-14）
- [x] 在放大後的全螢幕照片加入單指拖曳平移與超出範圍回彈限制
- [x] 保持全螢幕路線地圖的平移、縮放與旋轉手勢，且不對照片開放旋轉
- [x] 補強手勢邊界回歸測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；97 passed、1 skipped；Android Hermes bundle 5.59 MB；NitroModules／MapLibre 掃描 0）

## 活動詳情全螢幕檢視器重構（2026-08-14）
- [x] 修正活動詳情中的「Text strings must be rendered within a Text component」錯誤並補強防護測試
- [x] 將主視覺左下的照片入口改為照片縮圖，移除問號樣式並保留可直接開啟照片的操作
- [x] 點擊上方路線主視覺可直接進入全螢幕；全螢幕路線地圖不參與左右滑動換頁，保留地圖手勢
- [x] 將全螢幕底部資訊改為可上拉／下拉的活動摘要抽屜，拖曳時同步調整媒體可視高度
- [x] 完成互動結構回歸測試、TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；98 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## 固定活動資訊抽屜（2026-08-14）
- [x] 將全螢幕檢視器底部改為固定白色把手的活動資訊抽屜，路線與所有照片皆可使用
- [x] 建立收合摘要與上拉後完整騎乘資訊，並依參考影片維持一致的上拉／下拉手勢邏輯
- [x] 抽屜高度變化時同步調整上方路線或照片的可視高度，且不打斷照片切換與縮放手勢
- [x] 補強固定抽屜互動回歸測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；99 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## Strava 式媒體頁面與抽屜捲動（2026-08-14）
- [x] 將白色滑桿固定為抽屜頂端的視覺把手，不要求使用者只能由滑桿拖曳
- [x] 讓滑桿以下的抽屜內容區可直接上滑／下滑捲動完整活動資訊，且不干擾上方媒體手勢
- [x] 讓路線、縮圖入口與任一照片都使用同一個全螢幕媒體頁面及相同活動資訊抽屜
- [x] 補強 Strava 式手勢與媒體一致性測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## 活動媒體頁摘要精簡（2026-08-14）
- [x] 移除媒體頁抽屜頂端的白色滑桿圖示與右側「上滑查看」文字
- [x] 將下方內容收斂為活動摘要，對齊參考畫面的名稱、日期、類型與核心騎乘數據
- [x] 移除摘要中的額外手勢說明與媒體細節區塊，保留清楚且穩定的單一資訊版面
- [x] 補強摘要結構測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## 兩欄三列活動摘要數據（2026-08-14）
- [x] 將全螢幕活動摘要改為兩欄三列：距離／爬升海拔、移動時間／平均功率、平均速度／卡路里
- [x] 套用一致的中文單位與大字數據排版至路線與所有照片媒體頁
- [x] 補強摘要數據順序與版面結構測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## 活動詳情主頁摘要一致化（2026-08-14）
- [x] 將活動詳情主頁摘要改為兩欄三列：距離／爬升海拔、移動時間／平均功率、平均速度／卡路里
- [x] 移除主頁舊版三欄成就與次要數據列，讓主頁與全螢幕路線／照片使用同一套核心數據
- [x] 補強主頁與媒體頁摘要一致性測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.59 MB；NitroModules／MapLibre 掃描 0）

## 活動詳情起始摘要佈局（2026-08-14）
- [x] 起始狀態只顯示兩欄三列核心數據，隱藏活動標題、日期、類型與其他延伸內容至上滑後
- [x] 將核心數據向下配置並縮短起始黑色背景高度，擴大上方路線／照片可視空間
- [x] 補強起始摘要與上滑後完整內容的版面邊界測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.59 MB；NitroModules／MapLibre 掃描 0）

## 全螢幕照片滿版與摘要一致化（2026-08-14）
- [x] 讓全螢幕照片以裁切填滿方式覆蓋上方媒體空白區，保留既有縮放與平移操作
- [x] 以全螢幕路線／照片下方活動摘要為基準，反向調整主頁起始摘要的高度、間距與兩欄三列比例
- [x] 補強滿版照片與主頁／媒體摘要一致性測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.59 MB；NitroModules／MapLibre 掃描 0）

## 方向感知照片滿版裁切（2026-08-14）
- [x] 讀取本機照片原始長寬比，區分直式、橫式與近方形照片
- [x] 對直式照片採中央偏上裁切焦點，對橫式照片採中央主體裁切焦點，保留滿版縮放與平移手勢
- [x] 補強方向裁切策略測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## 精簡起始頁與照片焦點調整（2026-08-14）
- [x] 移除主頁「騎乘瞬間」區塊，起始頁只保留六項核心數據，其他資訊需上滑後查看
- [x] 重新配置全螢幕上方媒體舞台，減少無內容黑色區域並優先顯示照片主體
- [x] 支援長按照片手動調整裁切焦點，並提供可切換的無裁切完整照片檢視模式
- [x] 補強起始頁精簡、焦點調整與完整照片模式測試，完成 TypeScript、完整測試與 Android bundle 驗證（TypeScript 0 errors；100 passed、1 skipped；Android Hermes bundle 5.60 MB；NitroModules／MapLibre 掃描 0）

## 起始頁標題日期與中央滿版照片（2026-08-14）
- [x] 起始頁保留活動標題、日期與六項核心數據；活動類型、RPE、回放與分析等其餘資訊移至捲動後
- [x] 修正全螢幕照片舞台的上方黑色空白，以照片中央為焦點自動裁切填滿可用舞台
- [x] 補強起始摘要與中央滿版照片回歸測試，完成 TypeScript 0 errors、101 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 活動詳情首屏一致性修正（2026-08-14）
- [x] 將主頁與全螢幕媒體頁的首屏摘要改為同一個可視內容邊界，不得在主頁首屏露出活動詳情、RPE 或分析
- [x] 修正全螢幕照片舞台頂部黑色空白，令照片自舞台頂端開始以中央焦點滿版顯示
- [x] 補強首屏邊界回歸測試，完成 TypeScript 0 errors、101 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 活動摘要內容高度自適應修正（2026-08-14）
- [x] 移除主頁摘要的固定最小高度，避免為隱藏延伸資訊而產生大面積黑色空白
- [x] 讓摘要容器僅依活動摘要、標題、日期／類型與六項核心數據的實際內容高度自適應
- [x] 補強摘要自然高度回歸測試，完成 TypeScript 0 errors、101 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 全螢幕照片完整自適應顯示（2026-08-14）
- [x] 預設以完整照片等比例縮小置入全螢幕可用舞台，不裁切、不只顯示局部
- [x] 保留雙擊、雙指縮放與放大後平移，另保留使用者可選的裁切滿版模式
- [x] 補強完整照片預設模式回歸測試，完成 TypeScript 0 errors、101 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 主頁與媒體摘要起始位置對齊（2026-08-14）
- [x] 以全螢幕媒體收合舞台高度為基準，對齊主頁地圖舞台與黑色摘要卡片的起始位置
- [x] 維持摘要依內容自然收合，後續活動資訊可直接向下捲動，不以固定高度製造空白
- [x] 補強主頁與媒體摘要上緣對齊回歸測試，完成 TypeScript 0 errors、101 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 全螢幕照片自動填滿留白（2026-08-14）
- [x] 保持照片等比例，偵測到舞台留白時自動放大至填滿可用舞台
- [x] 以中央焦點處理必要的溢出裁切，避免畫面變形與大面積黑色空白
- [x] 補強自動填滿留白回歸測試，完成 TypeScript 0 errors、101 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 釘選模式地址導航（2026-08-14）
- [x] 按下地圖「釘選」時於地圖上方開啟地址輸入欄，保留既有地圖長按釘選
- [x] 將輸入地址解析為目的地座標、在地圖標記目的地並串接既有導航路線
- [x] 提供搜尋中、找不到地址及離線時的清楚回饋，完成 TypeScript 0 errors、103 passed／1 skipped 與 Android Hermes bundle 5.60 MB 驗證

## 地址搜尋增強與導航資料時效（2026-08-14）
- [x] 將最近成功搜尋的目的地保存於本機，並在釘選地址輸入欄下方提供快速選取
- [x] 將地址解析結果呈現為多筆候選清單，讓使用者選取正確目的地後再規劃導航
- [x] 評估圖資、道路與自行車道維修資訊更新來源，於線上可用時顯示資料時效與重新規劃提示，離線時清楚提示無法取得即時道路變動
- [x] 完成 TypeScript 0 errors、107 passed／1 skipped 與 Android Hermes bundle 5.61 MB 驗證

## Local-First 多運動模式（2026-08-14）
- [x] 建立 cycling、running、hiking、trail_running 四種運動類型及共用本機活動資料模型
- [x] 實作跑步／越野跑配速平滑、GAP、登山／越野跑 VAM 與運動專屬 METs 卡路里估算
- [x] 在地圖開始頁新增運動選擇器，依運動切換儀表板欄位、單位與自動暫停／GPS 防抖規則
- [x] 將完成運動寫入對應 activity_type，並讓歷史清單、活動詳情、圖表與摘要依類型顯示
- [x] 將運動類型寫入 GPX metadata 與 track type，支援外部平台識別
- [x] 補強多運動單元、資料流與匯出回歸測試，完成 TypeScript 0 errors、111 passed／1 skipped 與 Android Hermes bundle 5.65 MB 驗證

## 多運動訓練統計與地形分析（2026-08-14）
- [x] 讓週／月訓練統計依單車、跑步、登山與越野跑獨立計算並可切換
- [x] 新增跑步／越野跑的本機每公里分段配速分析
- [x] 新增登山／越野跑的本機海拔區間、停留與爬升分布分析
- [x] 補強統計與活動分析測試，完成 TypeScript 0 errors、114 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 運動選擇器與開始按鈕版面（2026-08-14）
- [x] 修正地圖底部面板安全區與高度，讓開始按鈕在各螢幕尺寸完整可見
- [x] 移除上方橫向運動選擇器，改為地圖左下角單一目前運動按鈕
- [x] 實作 Strava 風格底部運動選擇頁，提供搜尋與四種本機運動選項
- [x] 補強版面與模式選擇回歸測試，完成 TypeScript 0 errors、116 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 收合儀表板底部對齊（2026-08-14）
- [x] 移除開始按鈕下方因面板高度與安全區重複計算產生的多餘空白
- [x] 將收合儀表板與開始控制貼齊底部導覽列上緣，並在不同螢幕尺寸保留完整可點擊面積
- [x] 補強底部對齊回歸測試，完成 TypeScript 0 errors、116 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 智慧補給優先與動態閾值（2026-08-14）
- [x] 開啟智慧補給計算時，強制停用依時間／距離提醒補給與相關設定欄位
- [x] 讓導航儀表板卡路里與水分流失目標即時顯示智慧計算後的動態閾值
- [x] 確保動態閾值隨騎乘條件更新，確認補給提醒使用相同能量與水分目標
- [x] 補強設定互斥與動態閾值回歸測試，完成 TypeScript 0 errors、118 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 智慧補給語音播報（2026-08-14）
- [x] 達到智慧能量或水分閾值時，以離線 TTS 播報具體建議補給量與計算原因
- [x] 讓首次提醒、持續提醒與從背景恢復提醒皆沿用同一筆智慧補給計畫，並保留語音開關控制
- [x] 新增語音提醒內容與導航觸發資料流回歸測試，完成 TypeScript 0 errors、120 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 長下坡補給語音靜音（2026-08-14，已取消）
- [x] 使用者調整需求：不新增長下坡語音靜音設定
- [x] 使用者調整需求：不新增下坡語音延後或恢復機制
- [x] 使用者調整需求：不新增下坡語音靜音回歸測試

## 補給提醒範圍調整（2026-08-14）
- [x] 依使用者調整取消未實作的長下坡語音靜音功能，僅保留補能量與補水的持續提醒彈窗
- [x] 驗證能量與補水皆可獨立持續顯示，直到使用者按下已補給後才重設計數

## 長下坡補給語音暫停（2026-08-14）
- [x] 長下坡期間暫停補能量與補水的 TTS，但保留補給彈窗、計數、震動與本機通知
- [x] 離開下坡後，僅為仍待確認的能量或水分補給恢復一次對應語音提醒
- [x] 補強下坡語音暫停與離坡恢復回歸測試，完成 TypeScript 0 errors、123 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 智慧補水因素與運動入口位置（2026-08-14）
- [x] 盤點智慧補水現有的 FTP、體重、強度、時間、坡度及環境因素，補足可用且可靠的資料來源
- [x] 在智慧補給模式中以同一份資料來源調整補水門檻與建議量，並呈現可解釋的因素摘要
- [x] 將運動類型選擇入口移至開始鍵左側，避免底部面板上拉時遮擋地圖
- [x] 新增智慧補水與開始控制列版面回歸測試，完成 TypeScript 0 errors、127 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 智慧補給獨立門檻與異常值修復（2026-08-14）
- [x] 讓智慧能量與補水觸發門檻完全獨立於使用者手動輸入的卡路里／水分閾值
- [x] 對舊設定與輸入加入合理範圍防護，避免異常數值影響自訂或智慧模式顯示
- [x] 更新設定頁說明，清楚區分智慧計畫與自訂固定門檻的資料來源
- [x] 新增門檻隔離與異常值回歸測試，完成 TypeScript 0 errors、131 passed／1 skipped 與 Android Hermes bundle 5.67 MB 驗證

## 全自動智慧補給（2026-08-14）
- [x] 將能量與補水計畫改為零手動門檻輸入，完全由 FTP、體重、強度、時間、坡度與環境因素決定
- [x] 依運動生理補給範圍調整能量碳水與水分建議，保留離線資料不足時的安全本機估算
- [x] 從設定頁移除能量門檻基準與汗液流失提醒閾值，清理相關手動設定遷移與資料流
- [x] 新增全自動補給與設定頁移除回歸測試，完成 TypeScript 0 errors、130 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 全系統問號圖示清理（2026-08-14）
- [x] 掃描導航、設定、路線、歷史與活動詳情頁內的問號字元、問號圖示與不明圖示回退
- [x] 依功能語意替換所有問號圖示，並確保 Material／SF 圖示映射完整
- [x] 新增全系統問號圖示回歸檢查，完成 TypeScript 0 errors、132 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 全專案健康檢測與效能優化（2026-08-14）
- [x] 建立 TypeScript、測試、套件、原生依賴與 Android bundle 的健康檢測基準
- [x] 清理可安全移除的除錯輸出、未使用程式碼與重複依賴，維持 Expo 官方輕量模組架構
- [x] 稽核並優化定位監聽、計時器、事件清理、畫面重繪及本機軌跡持久化節流
- [x] 檢視定位／權限／儲存失敗防呆、Safe Area 與按鈕操作可達性
- [x] 新增必要回歸測試、完成完整測試與 Android bundle，並提供自我檢測摘要（TypeScript 0 errors、136 passed／1 skipped、Android Hermes bundle 5.66 MB）

## React Native 已棄用樣式相容性（2026-08-14）
- [x] 掃描全專案的 pointerEvents 屬性及 shadow* 舊式樣式
- [x] 遷移至 style.pointerEvents 與 boxShadow 相容寫法，維持原本互動與視覺層級
- [x] 新增棄用樣式回歸檢查，完成 TypeScript 0 errors、138 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證

## 補水耐受度與活動地圖互動優化（2026-08-14）
- [x] 檢查第三方套件更新狀態與剩餘 Hook lint advisory，清理安全可修正項目
- [x] 移除智慧補給模式下所有能量與補水手動門檻設定殘留
- [x] 依科學化耐受度將智慧補水改為 10–15 分鐘的小量分次建議，避免一次補充過多造成腸胃不適
- [x] 隔離活動詳情地圖手勢與外層捲動，並降低地圖傳遞與重繪負載
- [x] 新增小量補水回歸測試，完成 TypeScript、零 lint advisory、140 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證
- [x] 將多次騎乘的汗率校正改為完全自動化本機學習，移除人工補水量輸入
- [x] 新增自動汗率校正回歸測試，完成 TypeScript、零 lint advisory、139 passed／1 skipped 與 Android Hermes bundle 5.66 MB 驗證
- [x] 嚴格隔離活動詳情地圖手勢與外層頁面捲動，僅允許活動摘要以下的黑色內容區觸發頁面捲動
- [x] 降低活動詳情 Leaflet 地圖資料同步與重繪負載，完成手勢與效能回歸驗證（142 passed／1 skipped、Android Hermes bundle 5.66 MB）
- [x] 排查 Expo Go 開發者選單被喚起的來源，確認 App 觸控手勢不會造成誤觸並提供穩定實機測試方式（未發現 App 主動註冊開發者選單、搖晃或三指手勢）
- [x] 將智慧補給改為全自動倒數計時，依 FTP、體重、強度、時間、坡度與環境因素安排下次補水／補能量
- [x] 智慧補給僅在按下已補給後重新計算並啟動下一輪倒數，未確認時保留彈窗與讀數
- [x] 移除智慧補給的建議毫升、熱量與碳水顯示，僅提示補給水分或補給能量
- [x] 修正 Expo Go 騎乘時智慧補給未顯示彈窗，完成回歸測試與 Android bundle 驗證（146 passed／1 skipped、Android Hermes bundle 5.67 MB）
- [x] 智慧補給到期後持續顯示待確認彈窗，直到按下對應已補給按鈕
- [x] 背景或鎖定螢幕期間倒數到期時，回到前景立即補顯示未確認補給彈窗
- [x] 將智慧補水倒數維持在動態 10–15 分鐘範圍，智慧補能量倒數維持在動態 30–60 分鐘範圍
- [x] 新增待確認恢復與倒數時間範圍回歸測試，完成 TypeScript、零 lint advisory、147 passed／1 skipped 與 Android Hermes bundle 5.67 MB 驗證
- [x] 以現代運動營養科學指引校準智慧補水與補能量倒數範圍，依模型動態調整而非固定採用使用者指定分鐘數
- [x] 端到端核對背景／鎖定螢幕補給到期通知、待確認狀態保存與回到前景即時補顯示 Modal 的行為（148 passed／1 skipped、Android Hermes bundle 5.67 MB）
- [x] GPX 路線預覽依預估時間、爬升、坡度、FTP、體重與環境自動顯示最少／最多能量補給份數
- [x] 新增 GPX 能量補給份數估算回歸測試，完成 TypeScript、零 lint advisory、151 passed／1 skipped 與 Android Hermes bundle 5.68 MB 驗證
- [x] 正式 APK 加入通知、精確／背景位置與電池不受限制的權限健檢與逐項系統設定引導
- [x] 在開始騎乘前提醒未完成的背景騎乘必要設定，新增回歸測試並完成 TypeScript、零 lint advisory、154 passed／1 skipped 與 Android Hermes bundle 5.70 MB 驗證
- [x] 移除導航底部面板中間的開始前確認通知提示列
- [x] 完整移除活動詳情的軌跡回放控制、播放狀態與相關 UI，保留路線地圖與活動摘要
- [x] 清理軌跡回放廢碼與測試，完成 TypeScript、零 lint advisory、153 passed／1 skipped 與 Android Hermes bundle 5.69 MB 驗證
- [ ] 新增回歸測試、完成 TypeScript、完整測試與 Android bundle 驗證
- [x] 修正背景或鎖定螢幕恢復定位後的跳點、跨區直線與重疊軌跡
- [x] 為背景定位恢復、異常點拒絕與軌跡銜接新增回歸測試
- [x] 完成背景軌跡修正的 TypeScript、零 lint advisory、158 passed／1 skipped 與 Android Hermes bundle 5.70 MB 驗證
- [x] 騎乘中偵測系統音訊中斷時停止導航、補給與提示語音，讓出電話通話
- [x] 確保通話結束後不自動補播語音，持續保留 GPS 記錄、待確認補給畫面與本機通知
- [x] 新增通話優先音訊回歸測試，完成 TypeScript、零 lint advisory、162 passed／1 skipped 與 Android Hermes bundle 5.70 MB 驗證
- [x] 盤點補水、能量與自訂補給提醒的所有語音入口與文案
- [x] 將補給語音統一為「請補給水分」或「請補給能量」，移除數量、原因與其他延伸播報
- [x] 新增精簡補給語音回歸測試，完成 TypeScript、零 lint advisory、163 passed／1 skipped 與 Android Hermes bundle 5.70 MB 驗證
- [x] 修正能量與水分倒數同時到期時兩種補給彈窗皆顯示的行為
- [x] 確保能量與水分可依序分別確認，且每項只重啟自身倒數、不隱藏另一項
- [x] 新增雙補給同時到期與依序確認回歸測試，完成 TypeScript、零 lint advisory、164 passed／1 skipped 與 Android Hermes bundle 5.70 MB 驗證
- [x] 優化雙補給彈窗的資訊層級、文字可讀性、間距與按鈕觸控範圍
- [x] 確保能量與水分的確認操作在雙區塊模式下明確隔離且不互相干擾
- [x] 新增雙補給彈窗版面回歸測試，完成 TypeScript、零 lint advisory、165 passed／1 skipped 與 Android Hermes bundle 5.70 MB 驗證
- [x] 將手動時間／距離補給提醒拆分為能量與補水的獨立開關、觸發方式與間隔設定
- [x] 保持智慧補給模式與兩組手動規則互斥，並相容遷移舊版單一提醒設定
- [x] 更新設定頁、騎乘觸發與回歸測試，完成 TypeScript、零 lint advisory、167 passed／1 skipped 與 Android Hermes bundle 5.71 MB 驗證
- [x] 關閉智慧補給時，讓導航儀表板明確顯示並套用使用者的能量與補水手動規則
- [x] 讓能量與補水各自僅能在時間或距離提醒中擇一啟用
- [x] 將自訂補給品整合至共用的時間／距離、重複提醒、通知與確認流程
- [x] 新增手動規則顯示、互斥與自訂補給整合回歸測試，完成 TypeScript、零 lint advisory、171 passed／1 skipped 與 Android Hermes bundle 5.71 MB 驗證
- [x] 將自訂補給品模型簡化為品名與個別時間或距離規則，移除重複通知設定
- [x] 將自訂補給觸發、彈窗、語音、震動、通知、重複提醒與確認全部接入既有能量補水流程
- [x] 相容清理舊自訂補給的重複與下坡設定，新增整合回歸測試並完成完整驗證
- [x] 在設定頁補給區新增可開啟真實雙補給彈窗樣式的預覽按鈕
- [x] 確保預覽中的確認與稍後操作只關閉預覽，不寫入倒數、通知、騎乘或補給資料
- [x] 新增補給彈窗預覽回歸測試，完成 TypeScript、零 lint advisory、172 passed／1 skipped 與 Android Hermes bundle 5.71 MB 驗證
- [x] 在設定頁提供單獨預覽能量、單獨預覽補水與雙補給三種彈窗模式
- [x] 在補給預覽區加入依目前回饋開關運作的震動與提示音實測
- [x] 顯示目前重複提醒與長下坡暫停提醒的即時設定摘要
- [x] 新增預覽選項、回饋測試與設定摘要回歸測試，完成完整 Android 驗證
- [x] 重現並擷取 `expo config --json` 在 Android 建置初始化中的完整失敗原因：專案端與隔離無 Git／無 `.env` 環境皆成功，無法重現遠端 EAS init 失敗
- [x] 確認專案設定與相依未發現可修正的 Android 初始化衝突；遠端 EAS init 屬發佈服務工作程序失敗，非 App 原始碼錯誤
- [x] 重新驗證 Expo 設定解析、TypeScript、lint、173 passed／1 skipped 與 Android Hermes bundle 5.72 MB
- [ ] 檢查本機 Android SDK、Java、Gradle 與 Expo 原生 prebuild 先決條件
- [ ] 以本機 Android 工具鏈準備 release APK 建置，不使用 EAS 雲端初始化
- [ ] 驗證本機 release APK 產物、簽章狀態與安裝相容性限制
- [x] 對照最近發佈錯誤與先前成功的 Expo 設定／本地 bundle 驗證，確認並非專案回歸：最近 checkpoint 後僅有 todo.md 變更
- [x] 確認 Android 發佈初始化失敗的專案端與服務端責任邊界：Expo 設定與 Android bundle 可重現通過，失敗位於遠端 EAS init 工作程序
- [x] 重新核對 app.config.ts／app.json 設定來源、JSON 輸出與 plugins 套件存在性：採用 app.config.ts，所有自訂與官方插件均可解析
- [x] 以 Expo CLI 驗證完整設定輸出，模擬無版本控制與無環境檔的初始化條件：`npx expo config --json` 與隔離 EAS 環境皆成功
- [x] 未發現可重現的 Expo 設定問題；已完成 TypeScript、lint、173 passed／1 skipped、Android prebuild 與 Hermes bundle 5.72 MB 驗證
- [x] 檢查專案 Git 儲存庫初始化與目前版本控制狀態：已初始化且已有 main 分支與 origin 遠端，不需要再次執行 git init
- [x] 檢查 Expo 動態設定是否配置正確的 EAS projectId：目前未配置；EAS projectId 為雲端帳戶資源 ID，不能以本機 App ID 猜測或偽造
- [x] 驗證 Git 與 EAS projectId 前置條件：Git、Expo JSON、Android prebuild 與 bundle 均正常；需由具 EAS 權限的發佈服務完成 project:init 後寫入有效 projectId
- [x] 檢查 Expo EAS CLI 是否可用、是否已安全登入，以及目前帳戶能否存取本專案：CLI 未登入；已透過使用者已登入的 Expo 網頁帳戶確認並建立專案
- [x] 在具備有效 Expo 帳戶權限時初始化／重新連結 EAS 專案，取得有效 projectId：已建立 `bike-assistant` EAS 專案
- [x] 驗證並寫入 `extra.eas.projectId`，確認 Expo 設定輸出正確：owner 與 projectId 已解析於 `expo config --json`
- [x] 比對最新 EAS init failed 工作程序與既有錯誤：僅工作識別碼不同，仍為 `project:init`／`expo config --json` 遠端初始化失敗，無新增專案端線索
- [x] 重新驗證 Expo 設定、Git 遠端、EAS projectId 前置條件與可修復範圍：Git 與設定輸出正常；有效 EAS projectId 仍需具帳戶權限的遠端初始化程序建立
- [x] 調查可由手機瀏覽器操作、無需 Android SDK 的免費 APK 雲端建置方案
- [x] 比對候選服務對現有 Expo 專案、自訂插件、Git 來源與簽章需求的限制
- [x] 比對 Android 發佈卡在 1% 的工作狀態與既有 EAS 初始化失敗：1% 仍為遠端初始化階段，與 `project:init` 阻塞一致
- [x] 檢查專案端可觀測的發佈前置條件：目前僅有待辦與研究文件未保存，Expo 設定仍可成功輸出，無 App 設定回歸
- [x] 對照最新 EAS init failed 工作識別碼與既有初始化阻塞：錯誤型態一致，皆在遠端 `project:init` 與 `expo config --json` 階段中止
- [x] 整理最新工作識別碼與專案端驗證結果，供發佈服務端重設處理：最新 worker identity 為 `1@cfworkers-deploy-android-worker-675799485c-76j2g@`，需平台端查詢其完整初始化日誌
- [x] 查證 Expo Go Android 搖動開發選單是否提供使用者可關閉的現行設定：官方文件僅列出搖動為觸發開發選單方式，Expo Go 未提供可靠的使用者關閉開關
- [x] 在不能關閉時整理不需正式 APK 的低干擾實測替代方式：Expo Go 無法做騎乘震動實測的等效替代，應限於靜態功能驗證；實際騎乘需等待無開發選單的 standalone APK
- [x] 重新核對 Expo 設定輸出內的 `extra.eas.projectId` 與 EAS 所需欄位：已解析為 `af286610-25f1-45e5-afcc-6c30040d4124`
- [x] 檢查 EAS CLI 的登入狀態、專案資訊與可用權限，不讀取或輸出憑證：本機 CLI 未登入，但使用者已在 Expo 網頁帳戶 `jason123453021` 建立專案
- [x] 在有效 Expo 帳戶權限下初始化 EAS projectId 並寫回 Expo 動態設定：已加入 owner 與服務端簽發 projectId，`expo config --json` 與 TypeScript 驗證成功
- [x] 完成 EAS projectId 關聯後驗證：lint 0 errors、173 passed／1 skipped、Android Hermes bundle 5.72 MB
- [x] 盤點導航、紀錄與設定頁的色彩令牌、文字樣式與卡片邊界來源
- [x] 提升小螢幕文字、次要說明、表單列、搜尋列與空狀態的對比與閱讀層級
- [x] 新增可讀性回歸檢查，完成小螢幕可讀性守門、TypeScript、lint、179 passed／1 skipped 與 Android Hermes bundle 5.72 MB 驗證
- [x] 盤點所有主要畫面的現有文字對比、字級、卡片、按鈕與導航列不一致問題
- [x] 研究現代行動運動 App 的高對比、低干擾、單手操作與動態資訊層級原則
- [x] 建立全 App 共用的色彩、字級、間距、表面與互動元件視覺規範
- [x] 逐頁改善導航、路線、紀錄、設定、活動詳情、全螢幕媒體與彈窗
- [x] 新增全頁可讀性守門測試，完成 TypeScript、lint、179 passed／1 skipped 與 Android Hermes bundle 5.72 MB 驗證
- [x] 盤點各路由、詳情頁、彈窗、空狀態與底部導覽列在淺色／深色模式下的樣式來源
- [x] 定義雙主題的表面層級、文字層級、邊界、狀態色、輸入欄與互動元件規範
- [x] 將雙主題規範套用至所有可進入頁面與彈窗，消除硬編碼白／黑造成的主題錯置
- [x] 為淺色與深色模式新增全頁可讀性與觸控目標守門測試
- [x] 定位補給提醒模式選項與預覽按鈕在深色主題下的前景與背景色來源
- [x] 修正淺色模式按鈕、停用按鈕與邊界在深色主題下的文字對比
- [x] 補上補給模式按鈕對比守門測試，完成 TypeScript、6 項可讀性守門與 Android Hermes bundle 5.72 MB 驗證
- [x] 修正背景 GPS 精度選取按鈕在淺色綠色強調背景上的白字與次要文字對比
- [x] 修正補給提醒預覽雙補給淺色按鈕在深色主題下的圖示與文字對比
- [x] 新增 GPS 精度與補給預覽按鈕前景色回歸斷言
- [x] 掃描全專案淺色表面配白字、低透明度文字、停用狀態與過小標籤的對比風險
- [x] 將高風險按鈕、卡片、彈窗與圖表文字改用雙主題語意前景令牌
- [x] 新增全域前景／背景對比守門測試，完成 TypeScript、lint、180 passed／1 skipped 與 Android Hermes bundle 5.72 MB 驗證
- [x] 補給提醒的測試提示音同步播報對應短句語音，並與正式騎乘提醒共用回饋流程
- [x] 驗證語音開關、通話優先與長下坡暫停條件下的補給語音行為；正式騎乘既有統一守門流程維持不變
- [x] 在自訂補給品新增／編輯流程加入無副作用的提醒測試按鈕，依所屬能量或補水類別播放對應回饋
- [x] 修正自訂補給品的能量／補水與時間／距離選取按鈕，在深淺主題下均使用 onAccent 前景
- [x] 完整移除補給預覽及自訂補給品中的震動、音效與語音測試功能，不影響正式騎乘提醒
- [x] 更新補給提醒回歸測試，驗證測試入口不存在且正式提醒仍保留；TypeScript、lint、182 passed／1 skipped 與 Android bundle 5.72 MB 均通過
- [x] 移除自訂補給品表單的「整合提醒類別」選擇區與補給彈窗預覽入口
- [x] 清理補給預覽狀態、彈窗掛載與回歸測試，保留正式騎乘提醒規則
- [x] 驗證設定頁、正式補給提醒與 Android bundle 不受影響；TypeScript、lint、182 passed／1 skipped 與 Android Hermes bundle 5.71 MB 均通過
- [x] 盤點 Android 15 BOOT_COMPLETED 前景音訊服務警告、Android 15 無邊框淘汰 API、Android 16 方向限制與 R8 最佳化可修正範圍
- [x] 完成全專案 TypeScript、廢碼、依賴、定位／音訊／計時器資源釋放、資料寫入節流與防呆稽核
- [x] 實作可安全驗證的 Android 相容性、效能與介面適配修正，不新增 NitroModules 或 C++ 依賴
- [x] 完成全量靜態檢查、測試、Android bundle 與設定檢核，撰寫自我檢測與優化摘要報告
- [x] 擷取 Expo Go 通用載入錯誤的 Metro、Android bundle 與啟動日誌證據
- [x] 定位並修正 Expo Go 相容性、快取或啟動流程根因：Metro 同時建立 static Web SSR 與 Android 開發 bundle 時達 Node heap 上限
- [x] 完成 Expo Go Android bundle、TypeScript、lint 與完整回歸驗證：Android bundle HTTP 200、3.97 MB；185 passed／1 skipped
- [x] 蒐集 EAS Gradle 失敗的第一個實際錯誤、Expo 動態設定與本地 Android release 任務輸出
- [x] 定位並修正 EAS Gradle 建置的相依、預建置或設定衝突：修正無效 EAS AAB buildType 與過時 submit 憑證欄位
- [ ] 驗證 Expo config、Android Gradle release 任務、TypeScript、lint 與完整回歸測試；本地完整 Gradle 任務受沙盒記憶體限制中止，需以修正後 EAS 建置重新確認
- [ ] 取得重新建置後雲端 Run gradle 的首個 FAILURE／Caused by 例外區段
- [ ] 依實際 Gradle 例外完成原生建置根因修正與 release 回歸驗證
- [x] 盤點並降低目前 Android release 設定中不必要的 R8、資源縮減與多 ABI 編譯複雜度
- [x] 以保守 release 設定完成 Expo config、preview 預建置與完整品質驗證；雲端 EAS 重新建立 APK 待確認
- [ ] 蒐集 EAS Run gradlew 可取得的詳細失敗證據，對照本地 release Gradle 診斷
- [ ] 清理並重新生成 Android 原生層，掃描 package.json 與 Expo plugins 的不相容原生 C++ 模組或過時外掛
- [ ] 修正確認的 Android 建置根因，完成 release 品質驗證並於確認後重新提交 preview APK
- [x] 取得 EAS Run gradlew 實際根因：react-native-reanimated 4.1.6 的 assertNewArchitectureEnabledTask 因 newArchEnabled=false 失敗
- [x] 啟用 Expo SDK 54 受管理新架構設定、建立 Reanimated 建置守門並驗證 preview Android 預建置
- [ ] 重新提交 preview APK，確認 Run gradlew 已越過 Reanimated 新架構任務
- [x] 將導航儀表板右下角預設欄位由均速改為累計爬升
- [x] 在停紅燈或室內靜止時凍結速度、功率等即時讀數並避免 GPS 漂移造成假讀數
- [x] 提高車頭朝前地圖航向更新靈敏度，同時保留低速防抖
- [x] 將長按解除預設值改為 400ms，並修正解鎖後自動重新鎖定的狀態流程
- [x] 新增對應回歸測試，驗證騎乘儀表板、靜止資料與觸控鎖定行為（TypeScript 0 errors；191 passed／1 skipped）

## Expo Go 啟動失敗修正（2026-08-14）
- [ ] 蒐集 Expo Go 載入失敗的 Metro 與執行期錯誤日誌
- [ ] 修正造成 Expo Go 無法開啟的相容性或執行期崩潰程式路徑
- [ ] 完成 Expo Go 啟動、TypeScript、完整測試與 Android bundle 回歸驗證

## Expo Go 預覽載入卡住修正（2026-08-14）
- [x] 檢查並清除造成 Expo Go 停在「正在載入預覽」的卡住服務、Metro 快取或啟動程序
- [x] 重新啟動開發服務並確認 Metro 回應正常
- [x] 驗證 Expo Go Android bundle 端點以 HTTP 200 回應；首次冷啟動編譯約 64 秒，後續 bundle 已回到約 600 ms

## 騎乘結束清理與本機模型治理（2026-08-16）
- [x] 依單車、跑步、登山與越野跑微調靜止判定與自動暫停門檻，保留低速防抖
- [x] 結束並儲存活動時取消所有待確認補給通知、倒數與本機通知，避免活動後仍跳出提醒
- [x] 儲存完成後清空地圖頁即時軌跡、數字與暫態騎乘顯示
- [x] 盤點虛擬功率、配速、GAP、VAM、MET、卡路里與補水補給模型，建立版本化的本機學術依據與跨運動模式參數治理
- [x] 新增模型治理、活動結束清理與運動模式門檻的回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；195 passed／1 skipped）

## 靜默模型更新（2026-08-16）
- [x] 盤點可用的遠端模型發佈來源與現有整合設定，確認不需使用者手動操作
- [x] 建立 App 開啟時每七天至多一次的靜默模型更新檢查；騎乘期間不連線檢查，無網路時立即回退至已驗證本機版本
- [x] 驗證模型套件版本、結構、來源與完整性，僅在通過檢查時套用本機快取
- [x] 為啟動／騎乘觸發、離線回退與無效更新拒絕情境新增回歸測試，完成品質驗證與版本保存（Expo config 與模型端點有效；TypeScript 0 errors；199 passed／1 skipped）

## Expo Go 遠端更新下載失敗（2026-08-16）
- [x] 蒐集 Metro、Expo 設定與 Android bundle 端點診斷資訊，定位「Failed to download remote update」根因
- [x] 採取最小修正以恢復 Expo Go 開發連線，避免影響正式 APK 的每週模型檢查
- [x] 驗證 Expo Go Android bundle 端點與完整型別／回歸測試，保存穩定版本（Android bundle 連續 HTTP 200；TypeScript 0 errors；199 passed／1 skipped）

## 長按解除鎖定預設值（2026-08-16）
- [x] 修正既有本機設定仍保留 1200 ms 時未自動遷移為 400 ms 的問題
- [x] 驗證設定頁顯示、持久化載入與長按解鎖流程均使用 400 ms 預設，保存修復版本（數字與字串 1200 ms 均遷移；TypeScript 0 errors；200 passed／1 skipped）

## 全專案自我檢測與效能優化（2026-08-16）
- [x] 建立 TypeScript、lint、Expo Doctor、測試與 Android bundle 的健康度基線，盤點警告與失敗項目
- [x] 稽核並清理可重現的廢碼、重複匯入、開發輸出與不相容相依設定
- [x] 稽核地圖／儀表板重繪、定位與計時器監聽清理、本機軌跡寫入節流、權限／定位中斷／儲存失敗防呆與螢幕適配
- [x] 實作必要修正與回歸測試，完成建置前驗證、優化摘要與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；Expo Doctor 18/18；203 passed／1 skipped；Android Hermes 5.72 MB）

## 長按解除自訂時間（2026-08-16）
- [x] 保留設定頁的長按解除時間自訂欄位，將 400 ms 僅作為新安裝與舊版遷移後的預設值
- [x] 為長按解除時間加入合理範圍、空白與非數字輸入回退保護，避免不安全或無法解除的設定
- [x] 新增設定持久化與自訂值不被預設遷移覆寫的回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；203 passed／1 skipped）

## 長按解除快速選項（2026-08-16）
- [x] 移除長按解除時間的自由輸入，改為僅提供 400、800、1200 ms 快速選項
- [x] 以 400 ms 作為預設，加入目前選項的清楚視覺回饋與設定持久化
- [x] 新增快速選項介面與設定流程回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；204 passed／1 skipped）

## 補給重複提醒整合（2026-08-16）
- [x] 盤點「未關閉時重複提醒間隔」與「未關閉時重複提醒」兩個設定的實際用途與資料流
- [x] 整合為單一重複提醒間隔設定（0 = 關閉），清理舊分類開關且不影響雙補給、語音與下坡暫停流程
- [x] 新增整合後設定頁與通知重複流程回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；205 passed／1 skipped）

## 補給重複提醒快速選項（2026-08-16）
- [x] 在未關閉時重複提醒間隔下加入 0、30、60 秒快速選項
- [x] 顯示目前選取狀態並保持手動輸入與設定持久化
- [x] 新增快速選項回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；206 passed／1 skipped）

## 補給與補水提醒總開關（2026-08-16）
- [x] 新增啟用補給與補水提醒總開關，關閉時停止智慧、手動與自訂補給的倒數、彈窗、通知、語音、音效、震動及重複提醒
- [x] 關閉總開關時停用補給提醒相關設定控制，重新開啟後恢復原有可調整狀態與設定值
- [x] 整合前景與背景生命週期，新增總開關關閉／重啟的回歸測試並完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；207 passed／1 skipped）

## LINE 外部 GPX 匯入修復（2026-08-16）
- [x] 修復 Android content URI（例如 LINE 分享）無法直接讀取，改為先轉存至 App 本機快取再解析 GPX
- [x] 為外部分享、file URI 與無效 URI 建立 GPX 匯入回歸測試，確認錯誤訊息可理解且不暴露原生例外
- [x] 完成型別、lint 與測試驗證，重啟開發服務並保存修復版本（TypeScript 0 errors；lint 0 warnings／0 errors；209 passed／1 skipped）

## GPX 路線海拔校正（2026-08-16）
- [x] 盤點 GPX 路線預覽、時間預估、功率與補給估算使用的爬升／下降資料來源，定位海拔雜訊累加問題
- [x] 對 GPX 海拔建立保守平滑與最小累計變化門檻，避免微小抖動被重複計入總爬升與總下降
- [x] 新增海拔雜訊、連續真實爬升及資料流整合回歸測試，完成型別、lint、測試驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；212 passed／1 skipped）

## GPX 路線海拔二次校正（2026-08-16）
- [x] 檢查 GPX 中繼資料、軌跡點密度與路線級海拔輪廓，定位第一輪校正後仍顯著高估的來源（實際檔案 12,814 點、188.25 km，未含總爬升中繼資料）
- [x] 不採用外部平台數值或可信總爬升中繼資料優先策略；依使用者指示改為原始 GPX 距離與逐點海拔優先
- [x] 以使用者原檔完成高頻軌跡驗證；後續統一由原始 GPX 統計流程覆蓋

## GPX 原檔距離與海拔優先（2026-08-16）
- [x] 僅以匯入 GPX 的逐點座標計算原始距離，並以逐點 `<ele>` 海拔重建總爬升與總下降
- [x] 移除以外部平台數值作為校正目標的流程，保留原始距離、海拔輪廓與可追溯統計資料
- [x] 以使用者提供的環大台北 GPX 驗證原檔資料流：188.25 km、總爬升 1420 m、總下降 1401 m；並完成 TypeScript 0 errors、lint 0 warnings／0 errors、212 passed／1 skipped 的品質驗證與版本保存

## 導航儀表板重複資訊精簡（2026-08-16）
- [x] 移除同時顯示的「累計爬升」與「總爬升」，保留單一統一名稱與資料來源的「總爬升」讀數
- [x] 盤點主儀表板與下方摘要列，移除同一區域中語意重複的速度、坡度、功率、距離與爬升資訊；摘要列只補上均速、目前海拔與最大功率等未顯示指標
- [x] 新增導航儀表板去重回歸測試，完成型別、lint、測試驗證、實機版面檢查與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；215 passed／1 skipped）

## 車頭朝前地圖防抖（2026-08-17）
- [x] 盤點 GPS 行進方向、羅盤航向與地圖旋轉的競爭更新，定位低速與訊號不穩時的晃動來源
- [x] 加入航向可信度門檻、角度死區、變化速率限制與平滑旋轉，避免微小變化反覆帶動地圖
- [x] 建立靜止／低速抖動、正常行進與實際轉彎回歸測試，完成型別、lint、測試驗證、實機測試與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；219 passed／1 skipped）

## 騎乘干擾抑制與補給模型整合（2026-08-17）
- [x] 停止騎乘過程反覆彈出的狀態通知與音效，僅保留補給／補水到期提醒及使用者主動啟用的必要通知
- [x] 將觸控解鎖後自動重新鎖定時間加入設定，修正解鎖後未重新上鎖問題
- [x] 參考 Strava 車頭朝前體驗，改善穩定轉向、可靠轉彎追隨與低速方向保持
- [x] 車輛停止或自動暫停時凍結能量與補水倒數並禁止彈窗，恢復移動後續接原倒數
- [x] 在設定新增單包補給碳水克數，依碳水份量調整能量補給倒數，並同步路線分析補給規劃
- [x] 倒數啟動後鎖定至到期；僅在用戶確認已補給／已補水時才重算下一輪倒數
- [x] 校正騎乘中總爬升與最大功率異常，讓儀表板使用保守且可信的即時數據
- [x] 將補水倒數模型最短基準限制為 10 分鐘
- [x] 修正手勢喚醒與補給彈窗後螢幕調暗狀態未恢復原亮度
- [x] 新增跨通知、鎖定、航向、補給、數據及亮度流程的回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；226 passed／1 skipped）
- [x] 補給與補水彈窗出現時保持螢幕亮起，直到所有待確認項目均按下確認後，才恢復調暗計時
- [x] 將補給彈窗的實際待確認狀態接入亮度保持管理器，確保單一與雙提醒皆會持續亮屏
- [x] 僅在全部補給／補水項目確認後解除亮屏保持並重新啟動調暗倒數，新增回歸測試與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；229 passed／1 skipped）

## 騎乘核心資料、補給與釘選導航修正（2026-08-17）
- [x] 釘選導航插入或切換時持續記錄騎乘軌跡與累加距離、時間、爬升、卡路里及功率，僅「結束騎乘」才可重置
- [x] 補給／補水由彈窗或系統通知任一確認後，統一完成確認、取消所有堆疊通知並同步關閉所有對應介面
- [x] 修正背景回到前景、釘選導航與其他功能作用時重複出現雙補給彈窗的狀態恢復與去重流程
- [x] 移除車頭朝前模式，改為保留用戶雙指旋轉地圖方向；新增可設定的回歸中心時間，回歸時沿用用戶方向
- [x] 釘選導航採自行車道優先並在明顯繞路或耗時較高時改用較快的一般道路，再於有利路段回到自行車道
- [x] 校正暫停時間、移動時間、活動總時間與均速計算的一致性；維持距離／爬升／最大虛擬功率的既有品質守門
- [x] 建立補給恢復、地圖方向、路線候選與騎乘時間的跨流程回歸測試，完成 TypeScript、lint 與 Vitest 驗證
- [x] 稽核並校正距離、爬升、時間、速度、最大功率與活動統計，以完整本機騎乘軌跡和可信讀數為單一來源
- [x] 新增跨騎乘、導航、補給通知、地圖手勢與活動統計回歸測試，完成品質驗證與版本保存

## 完整活動統計對齊（2026-08-17）
- [x] 盤點距離、移動／活動／暫停時間、平均／最大速度、海拔／爬升、功率、卡路里與訓練指標的來源、濾波與儲存欄位
- [x] 依公開可驗證的活動資料定義，建立本機統計對齊準則與明確的不可用資料處理規則
- [x] 將距離、時間、速度、海拔、爬升、功率、卡路里與衍生訓練指標收斂為單一可測試計算鏈
- [x] 將統一統計接入即時儀表板、活動儲存、活動摘要與歷史詳情，消除重複計算與欄位語意差異
- [x] 建立多情境資料品質與統計一致性回歸測試，完成 TypeScript、lint、Vitest 驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；245 passed／1 skipped）

## 唯一騎乘生命週期守門（2026-08-17）
- [x] 盤點釘選導航、臨時 GPX 載入／替換、清除導航圖層、地圖互動及前後台切換中的騎乘狀態與累計變更點
- [x] 建立唯一「停止騎乘」可結束、重置或改變騎乘累計基準的生命週期守門
- [x] 確保釘選導航與臨時 GPX 操作只變更導航圖層，不中斷或修改即時軌跡、距離、時間、速度、爬升、功率、卡路里及訓練統計
- [x] 建立釘選導航、臨時 GPX、清除導航圖層、背景恢復及停止騎乘的跨流程回歸測試，完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；253 passed／1 skipped）

## 今日功能與修復盤點（2026-08-17）
- [x] 匯整今日已完成、未完成與需實車驗證的功能／修復，並核對各項版本與測試證據
- [x] 將盤點發現的可由程式修復遺留項目逐一完成，補齊回歸測試並保存版本（本輪未發現尚可由程式修復的遺留項目）
- [ ] 在 Android 實機完成釘選導航、臨時 GPX、背景回補、雙補給通知同步與活動統計的連續騎乘驗證
- [ ] 透過具備 Expo／EAS 發佈權限的環境取得正式 Android APK／AAB 或 Run Gradle 首個失敗區段

## 單包碳水補給模型核對（2026-08-18）
- [x] 盤點單包能量補給碳水克數的設定頁可見性、資料持久化、智慧補給倒數與路線攜帶份數資料流
- [x] 修正設定頁顯示或啟用條件，確保使用者可清楚設定 10–100 g 並立即帶入模型
- [x] 補齊碳水設定、智慧能量倒數與 GPX 路線補給份數的端到端回歸測試與品質驗證（TypeScript 0 errors；lint 0 warnings／0 errors；257 passed／1 skipped）

## 獨立智慧能量／補水開關（2026-08-18）
- [x] 盤點目前單一智慧補給模式、手動時間／距離規則、前景倒數與背景提醒的資料流
- [x] 新增可持久化的「智慧能量補給」與「智慧補水」獨立開關，並安全遷移舊設定
- [x] 讓使用者可單獨或同時啟用智慧能量與智慧補水；關閉任一項時不影響另一項的倒數、彈窗、通知與確認流程
- [x] 更新設定頁、前景／背景提醒守門與回歸測試，驗證四種開關組合並完成品質驗證與版本保存（TypeScript 0 errors；lint 0 warnings／0 errors；262 passed／1 skipped）

## Expo Go 最新 Bundle 載入核對（2026-08-18）
- [x] 檢查 Expo Go 直接載入時的 Metro 服務、bundle 快取與更新行為，確認手機是否取得最新程式
- [x] 移除 Metro 的離線正式包旗標，恢復 Expo Go 可取得的開發 manifest 與即時 bundle 更新；Android 開發 bundle 已重新編譯成功（14.4 秒）
- [x] 將 Expo、expo-constants 與 expo-file-system 升至 SDK 54 建議的相容修補版本，重新驗證 Android 開發 bundle HTTP 200 與 TypeScript 0 errors

## Expo Go 遠端更新下載失敗（2026-08-18）
- [x] 診斷 Android Expo Go 顯示「Failed to download remote update」時的外部 manifest、更新 URL、TLS 與 Android bundle 可達性
- [x] 修正可重現的開發服務或 Expo 更新設定，並提供手機端完整重新載入步驟
- [x] 在 Metro 啟動後預先編譯 Android Hermes bundle，避免 Expo Go 首次請求等待冷啟動編譯而逾時；外部 launch bundle HTTP 200、暖機回應約 0.38 秒

## 移除長下坡暫停提醒（2026-08-18）
- [x] 盤點「長下坡暫停提醒」在設定頁、設定模型、前景與背景補給流程及回歸測試中的使用位置
- [x] 移除設定頁開關與持久化欄位，相容忽略既有本機資料
- [x] 移除下坡期間延後、禁止或恢復補給提醒的守門邏輯，維持一般提醒不受坡度影響
- [x] 完成型別、lint、回歸測試與開發服務驗證（TypeScript 0 errors；lint 0 warnings／0 errors；263 passed／1 skipped）

## 重設所有設定（2026-08-18）
- [x] 盤點設定持久化模型與既有危險操作模式，確認重設僅影響 App 偏好、不刪除騎乘活動與媒體
- [x] 在 SettingsContext 新增可測試的重設方法，原子恢復預設設定並覆寫本機設定儲存
- [x] 在設定頁加入「重設所有設定」按鈕、二次確認與完成回饋
- [x] 新增重設資料邊界與設定頁互動回歸測試，完成品質驗證（TypeScript 0 errors；lint 0 warnings／0 errors；266 passed／1 skipped）

## 每小時碳水上限與智慧能量倒數（2026-08-18）
- [x] 盤點單次碳水克數、體重、運動強度、智慧能量倒數與路線補給份數的現有資料流
- [x] 定義手動每小時碳水上限與科學建議模式的安全範圍、建議邏輯與資料語意；依據保存於 reports/carbohydrate-hourly-limit-evidence-2026-08-18.md
- [x] 新增設定頁、持久化遷移與統一能量倒數模型，讓單次碳水與每小時上限共同決定下次提醒時間
- [x] 建立模式、體重、單次份量、上限與倒數時間的回歸測試，完成品質驗證（TypeScript 0 errors；lint 0 warnings／0 errors；272 passed／1 skipped）

## 手動碳水上限智慧計算（2026-08-18）
- [x] 盤點現有科學上限計算與手動設定頁互動，確認可直接重用同一演算法
- [x] 在手動模式加入智慧計算並套用按鈕，自動填入建議 g/h 但不切換模式，允許後續微調
- [x] 補上設定頁互動回歸測試與完整品質驗證（TypeScript 0 errors；lint 0 warnings／0 errors；273 passed／1 skipped）

## 發布前全專案品質管制（2026-08-18）
- [x] 建立發布前品管基準，盤點既有測試、版本配置、未提交變更與已知實機限制
- [x] 稽核活動統計、GPS 軌跡品質、背景復原、定位／計時器監聽與持久化批次流程
- [x] 稽核權限拒絕、純離線行為、螢幕安全區、觸控防護與 Expo Go 開發邊界
- [x] 稽核發布設定、圖示、版本、Android API、原生套件相容性與除錯殘留
- [x] 修正所有可重現問題並補足回歸測試：加入開始騎乘定位服務／權限／背景失敗防呆；清理熱路徑開發日誌；修正智慧通道 Hook 依賴
- [x] 執行完整型別、lint、測試、Expo Doctor 與 Android Hermes bundle 匯出驗證；正式簽署 APK／AAB 依專案規範交由管理介面的 Publish 執行
- [x] 產出發布前品管檢驗清單（reports/release-preflight-qc-2026-08-18.md）、保存版本並交付結果

## d477a664 效能與穩定性復檢（2026-08-19）
- [x] 建立版本基準，執行型別、Lint、完整回歸、Expo Doctor 與 Android bundle 預檢
- [x] 稽核定位、計時器、AppState、背景任務、騎乘統計與本機持久化的生命週期及熱路徑
- [x] 稽核離線回退、權限防呆、設定／按鈕有效性、螢幕安全區與發布設定
- [x] 修復可重現問題，補足回歸、保存版本並交付實機驗證重點
- [x] 移除無實際功能且永遠無法驗證的 Android 懸浮窗權限與引導項目
- [x] 移除地圖觸控鎖定覆蓋層的空白按鈕處理器
- [x] 將分享卡的複製文字按鈕接入系統剪貼簿並移除 TODO 殘留

## 修復 Expo Go 遠端更新下載失敗（2026-08-19）
- [x] 檢查 Android Expo manifest、遠端 Hermes bundle、Metro 啟動設定與預熱流程
- [x] 修復可重現的遠端更新下載或逾時風險，避免手機在 JavaScript 載入前顯示錯誤
- [x] 驗證 manifest 與 Android bundle 可由公開開發網址快速下載，並提供手機端重新載入步驟

## Expo 專案移轉至 jason123453021eve（2026-08-19）
- [x] 核對目前 Expo 專案擁有者、projectId、目標帳號成員權限與可移轉條件
- [x] 說明移轉對既有 EAS projectId、憑證、Android 套件與雲端建置的影響，取得執行確認
- [x] 執行所有權移轉、更新專案設定並驗證目標帳號可發起雲端建置
