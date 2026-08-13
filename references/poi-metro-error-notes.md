# POI MetroServerError 排查筆記

## 初步發現

地圖頁的 POI 載入效果使用 `await import('@/lib/poi-manager')` 與 `await import('@/lib/poi-data')`。在 Expo Go 開發環境，這類執行期動態別名匯入會向 Metro 請求額外模組；請求失敗時，錯誤物件被直接輸出為 `Failed to load POIs: MetroServerError`。

## 修正方向

將 POI 管理與資料模組改為頂層靜態匯入，讓 Metro 在首次 Android Bundle 時完整解析；同時保留本機範例 POI 回退資料，並將網路暫時不可用視為非致命狀態，不在 Expo Go 顯示開發伺服器錯誤。
