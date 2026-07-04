# MapLibre 評估報告
## 導航系統全面升級 - 地圖引擎選型

**評估日期**: 2026-07-01  
**評估範圍**: MapLibre GL JS / MapLibre React Native  
**評估對象**: GPX 軌跡匯入、動態方向箭頭、Turn-by-Turn 導航、偏離重劃  
**決策標準**: 功能完整性、開發成本、性能表現

---

## 執行摘要

### 評估結論

**建議：立即切換至 Mapbox Navigation SDK**

MapLibre 雖然在 **地圖渲染** 和 **GPX 軌跡顯示** 上表現優異，但在 **Turn-by-Turn 導航** 和 **實時重規劃** 上存在明顯缺陷。考量到項目的複雜性和時間成本，建議採用 Mapbox Navigation SDK。

| 評估項目 | MapLibre | Mapbox | 建議 |
|---------|---------|--------|------|
| **GPX 軌跡匯入** | ✅ 優異 | ✅ 優異 | 兩者都可 |
| **動態方向箭頭** | ✅ 可行 | ✅ 原生支援 | Mapbox 更簡單 |
| **Turn-by-Turn 導航** | ⚠️ 需自行實現 | ✅ 完整 SDK | **Mapbox 推薦** |
| **實時重規劃** | ⚠️ 複雜 | ✅ 內建 | **Mapbox 推薦** |
| **離線地圖** | ✅ 支援 | ✅ 支援 | 兩者都可 |
| **開發成本** | 🔴 高 (4-6 週) | 🟢 低 (1-2 週) | **Mapbox 更經濟** |
| **許可證** | 🟢 開源免費 | 🔴 商業授權 | MapLibre 更便宜 |

---

## 詳細評估

### 1. GPX 軌跡匯入

#### MapLibre 支援度：✅ 優異

**優勢**：
- 完整支援 GeoJSON 和 GPX 格式
- 可直接將 GPX 轉換為 GeoJSON 並作為 Layer 添加
- 性能優異，支援大型軌跡文件（數千個座標點）
- 開源社區提供多個 GPX 解析庫

**實現方案**：
```typescript
// 1. 使用 gpxparser 或 togeojson 將 GPX 轉換為 GeoJSON
import * as toGeoJSON from '@mapbox/togeojson';
const gpxData = await fetch('route.gpx').then(r => r.text());
const geoJson = toGeoJSON.gpx(new DOMParser().parseFromString(gpxData, 'text/xml'));

// 2. 添加到 MapLibre 地圖
map.addSource('gpx-route', { type: 'geojson', data: geoJson });
map.addLayer({
  id: 'gpx-line',
  type: 'line',
  source: 'gpx-route',
  paint: { 'line-color': '#1e40af', 'line-width': 3 }
});
```

**評估結論**：✅ MapLibre 完全支援，開發成本低

---

### 2. 動態方向箭頭

#### MapLibre 支援度：✅ 可行（但需自行實現）

**實現方案**：
- 使用 Symbol Layer 配合 `symbol-placement: line` 在路線上放置箭頭符號
- 通過 `symbol-rotation` 動態調整箭頭方向
- 使用 `icon-image` 指向自訂的箭頭 SVG

**實現難度**：中等（需要自行計算方向角度）

**代碼範例**：
```typescript
// 添加箭頭符號層
map.addLayer({
  id: 'route-arrows',
  type: 'symbol',
  source: 'gpx-route',
  layout: {
    'symbol-placement': 'line',
    'icon-image': 'arrow-icon',
    'icon-size': 1,
    'icon-rotation-alignment': 'map',
    'symbol-spacing': 50 // 每 50px 放置一個箭頭
  }
});
```

**評估結論**：✅ 可行，開發成本中等（1-2 天）

---

### 3. Turn-by-Turn 導航

#### MapLibre 支援度：🔴 **不支援**（需完全自行實現）

**問題分析**：

1. **無內建路線規劃引擎**
   - MapLibre 只提供地圖渲染，不包含路線規劃功能
   - 需要集成第三方路由引擎（OSRM、GraphHopper、Valhalla）

2. **無內建轉彎檢測**
   - 需要自行實現轉彎點檢測邏輯
   - 需要計算用戶當前位置與路線的偏差

3. **無內建語音導航**
   - 需要自行實現文字轉語音（TTS）
   - 需要管理 Audio Focus 和喚醒機制

4. **無內建 Rerouting**
   - 需要實時監控用戶位置
   - 檢測到偏離時手動調用路由引擎重新規劃

**開發成本估算**：
- 路由引擎集成：2-3 週
- 轉彎檢測邏輯：1-2 週
- 語音導航實現：1-2 週
- 重規劃機制：1-2 週
- **總計：5-9 週**

**評估結論**：🔴 MapLibre 不適合此需求，開發成本過高

---

### 4. 實時重規劃 (Rerouting)

#### MapLibre 支援度：🔴 **不支援**

**需要自行實現的邏輯**：
1. 實時監控 GPS 位置
2. 計算位置與路線的距離
3. 檢測偏離閾值（通常 50-100 米）
4. 觸發新的路線規劃請求
5. 無縫切換到新路線

**複雜性**：
- 需要與路由引擎 API 頻繁通信
- 需要優化性能以避免過度請求
- 需要處理網絡延遲和超時

**評估結論**：🔴 MapLibre 需要大量自訂代碼

---

### 5. Mapbox Navigation SDK 對比

#### Mapbox 支援度：✅ **完整**

**優勢**：

| 功能 | Mapbox | 實現方式 |
|------|--------|--------|
| **路線規劃** | ✅ 內建 | Mapbox Directions API |
| **轉彎檢測** | ✅ 自動 | Navigation SDK 內建 |
| **語音導航** | ✅ 內建 | 多語言 TTS 支援 |
| **Rerouting** | ✅ 自動 | 後台自動監控 |
| **動態箭頭** | ✅ 內建 | 自動渲染 |
| **離線地圖** | ✅ 支援 | Offline SDK |

**開發成本**：
- 集成 Mapbox Navigation SDK：3-5 天
- 自訂 UI 和樣式：2-3 天
- **總計：1-2 週**

**評估結論**：✅ Mapbox 提供完整的開箱即用方案

---

## 成本分析

### MapLibre 方案

**初期成本**：
- 地圖引擎：$0（開源免費）
- 路由引擎：$0-500/月（OSRM 自託管或 GraphHopper 免費層）
- 開發成本：**5-9 週**（人力成本高）

**長期成本**：
- 維護自訂代碼：持續投入
- 路由引擎維護：持續投入
- 無 Mapbox 技術支援

### Mapbox 方案

**初期成本**：
- Mapbox Navigation SDK：$0-50/月（基於使用量）
- 開發成本：**1-2 週**（人力成本低）

**長期成本**：
- API 使用費：~$100-500/月（基於用戶數和請求量）
- Mapbox 官方技術支援：包含

**成本對比**：
- 若開發團隊時薪 $50/小時
- MapLibre 額外開發成本：5-9 週 × 40 小時 × $50 = **$10,000-18,000**
- Mapbox 月度成本：$200-500 × 12 = **$2,400-6,000/年**
- **Mapbox 在 2-3 年內更經濟**

---

## 技術風險評估

### MapLibre 方案的風險

| 風險 | 等級 | 說明 |
|------|------|------|
| **開發進度延誤** | 🔴 高 | 需要自行實現複雜邏輯，容易遇到技術瓶頸 |
| **性能問題** | 🟡 中 | 自訂代碼可能存在性能瓶頸 |
| **維護負擔** | 🔴 高 | 需要持續維護和優化自訂代碼 |
| **社區支援** | 🟡 中 | MapLibre 社區較小，問題解決較慢 |
| **長期可維護性** | 🔴 高 | 若開發人員離職，維護困難 |

### Mapbox 方案的風險

| 風險 | 等級 | 說明 |
|------|------|------|
| **成本** | 🟡 中 | 需要持續付費，但成本可控 |
| **廠商鎖定** | 🟡 中 | 依賴 Mapbox 服務，但可隨時遷移 |
| **API 限制** | 🟢 低 | Mapbox 提供充足的免費額度 |

---

## 最終建議

### 決策：**採用 Mapbox Navigation SDK**

**理由**：

1. **時間成本最優**
   - MapLibre 需要 5-9 週自行開發
   - Mapbox 只需 1-2 週集成
   - 節省 4-7 週的開發時間

2. **功能完整性**
   - Mapbox 提供完整的 Turn-by-Turn 導航
   - 包含自動 Rerouting、語音導航、離線地圖
   - MapLibre 需要自行實現，容易出現 Bug

3. **長期維護成本**
   - Mapbox 由官方維護，無需擔心技術債
   - MapLibre 自訂代碼需要持續維護
   - 開發人員離職後，維護困難

4. **性能和穩定性**
   - Mapbox Navigation SDK 經過數百萬用戶驗證
   - 性能優化和 Bug 修復由官方負責
   - MapLibre 自訂實現容易出現邊界情況

5. **技術支援**
   - Mapbox 提供官方文檔和技術支援
   - MapLibre 社區支援有限

---

## 後續行動

### 如果採用 Mapbox

1. **立即申請 Mapbox 帳戶和 API Key**
2. **評估 Mapbox 定價方案**
   - 推薦：Navigation SDK + Directions API
   - 預估月度成本：$200-500（基於 1000+ 日活用戶）
3. **開始 Phase 1 - Step 2：Mapbox 集成方案**

### 如果堅持 MapLibre

1. **需要額外 5-9 週開發時間**
2. **需要選擇第三方路由引擎**（OSRM、GraphHopper、Valhalla）
3. **需要自行實現**：
   - 轉彎檢測邏輯
   - 語音導航系統
   - Rerouting 機制
   - 性能優化

---

## 附錄：MapLibre 優勢保留

即使採用 Mapbox Navigation SDK，仍可在以下場景使用 MapLibre：

1. **離線地圖顯示**
   - 使用 MapLibre 的離線功能
   - Mapbox 也支援離線地圖

2. **自訂地圖樣式**
   - MapLibre 和 Mapbox 都支援 MapBox Style Spec
   - 可自訂顏色、圖層、標籤

3. **GPX 軌跡回放**
   - 使用 MapLibre 或 Mapbox 都可以
   - 兩者性能相當

---

## 評估人員簽署

**評估完成日期**: 2026-07-01  
**評估結論**: 建議採用 Mapbox Navigation SDK  
**預期開發時間**: 1-2 週（vs MapLibre 5-9 週）  
**成本節省**: 4-7 週人力成本（約 $10,000-18,000）

---

## 參考資源

- [MapLibre React Native 文檔](https://maplibre.org/maplibre-react-native/)
- [Mapbox Navigation SDK](https://docs.mapbox.com/android/navigation/)
- [OSRM 路由引擎](https://project-osrm.org/)
- [GraphHopper 路由引擎](https://www.graphhopper.com/)
- [MapLibre 社區討論](https://github.com/maplibre/maplibre/discussions/210)
