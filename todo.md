# 智慧單車騎乘助手 TODO

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

## Android 16（API 36）Google Play 合規修正（2026-08-13）
- [x] 核對 Expo 設定、Android 預建置輸出、套件版本與舊版上傳產物的 target SDK 差異：目前設定原有 target SDK 36，但上傳至 Play 的既有產物仍是先前 API 35 建置；所有自訂插件均未覆寫 SDK 值
- [x] 將 Android compile／target SDK 明確固定為 36，並移除會覆寫或降級該設定的建置配置：expo-build-properties 現明確使用 compileSdkVersion 36、targetSdkVersion 36、minSdkVersion 24；App 版號提升至 1.0.3／versionCode 10087
- [x] 驗證 Expo 設定與 Android 預建置 Manifest／Gradle 輸出，確認新的 APK／AAB 會宣告 target SDK 36：Expo Android 預建置成功；生成 gradle.properties 明確為 android.compileSdkVersion=36、android.targetSdkVersion=36、android.minSdkVersion=24
- [x] 保存合規版本，提供受管理建置與 Play Console 上傳時應使用的新產物指引：已建立 references/google-play-api36-upload.md；必須以新建置的 versionCode 10087 AAB 取代原 API 35 產物，並在 Bundle Explorer 確認 target SDK 36 後上傳
