# 實時導航與語音提示集成指南

## 概述

本文檔說明如何將實時 GPS 位置追蹤與語音提示功能集成到自行車導航應用中。系統會根據當前位置自動觸發語音提醒，無需用戶手動操作。

## 核心功能

### 1. 實時位置追蹤
- 使用 Expo Location API 進行高精度 GPS 追蹤
- 5 秒更新一次位置或移動 10 米時更新
- 記錄完整的騎乘軌跡

### 2. 自動語音提示
- **接近轉彎（300 米）**：播放「X 公尺後左/右轉」
- **立即轉彎（50 米）**：播放「立即左/右轉」
- **偏離路線**：播放「您已偏離路線 X 公尺」

### 3. 導航進度追蹤
- 實時計算距離下一轉彎的距離
- 追蹤已騎行距離和平均速度
- 計算預計到達時間 (ETA)

### 4. 偏離路線檢測
- 自動檢測用戶是否偏離路線
- 當偏離超過 50 米時發出警告
- 返回路線時提示用戶

## 架構

```
RealtimeNavigationManager (核心管理器)
├── GPS 位置追蹤
├── 轉向導航集成
├── 語音提示觸發
├── 軌跡記錄
└── 事件發射

useRealtimeNavigation (React Hook)
├── 狀態管理
├── 事件訂閱
└── 生命週期管理

RealtimeNavigationScreen (UI 組件)
├── 實時狀態顯示
├── 導航控制
├── 事件歷史
└── 進度追蹤
```

## 使用方式

### 基本集成

```tsx
import { useRealtimeNavigation } from '@/hooks/use-realtime-navigation';
import { type NavigationRoute } from '@/lib/realtime-navigation-manager';

function MyNavigationComponent() {
  const { startNavigation, stopNavigation, state } = useRealtimeNavigation({
    onEvent: (event) => {
      console.log('Navigation event:', event);
    },
  });

  const route: NavigationRoute = {
    id: 'route-1',
    polyline: [[25.0, 121.5], [25.01, 121.51], [25.02, 121.52]],
    instructions: [
      {
        id: '1',
        type: 'turn-left',
        direction: 'left',
        angle: 90,
        distance: 500,
        street: '中山路',
        instruction: '左轉進入中山路',
        coordinates: [25.01, 121.51],
      },
      // ... 更多指令
    ],
    totalDistance: 1500,
    totalDuration: 600,
  };

  return (
    <View>
      <Pressable onPress={() => startNavigation(route)}>
        <Text>開始導航</Text>
      </Pressable>

      <Text>距離下一轉彎: {state.distanceToNextTurn} m</Text>
      <Text>已騎行: {state.totalDistanceTraveled} m</Text>
      <Text>當前速度: {state.currentSpeed} m/s</Text>
      <Text>預計到達: {state.eta} 秒</Text>

      {state.isOffRoute && (
        <Text>⚠️ 您已偏離路線 {state.offRouteDistance} m</Text>
      )}

      <Pressable onPress={() => stopNavigation()}>
        <Text>停止導航</Text>
      </Pressable>
    </View>
  );
}
```

### 事件監聽

```tsx
const { startNavigation } = useRealtimeNavigation({
  onEvent: (event) => {
    switch (event.type) {
      case 'approaching-turn':
        console.log('接近轉彎:', event.data.instruction);
        break;
      case 'immediate-turn':
        console.log('立即轉彎:', event.data.instruction);
        break;
      case 'off-route':
        console.log('偏離路線:', event.data.distance, 'm');
        break;
      case 'back-on-route':
        console.log('返回路線');
        break;
      case 'step-completed':
        console.log('步驟完成:', event.data.stepIndex);
        break;
      case 'navigation-complete':
        console.log('導航完成');
        break;
    }
  },
});
```

### 軌跡導出

```tsx
const { getTrackPoints, exportTrackAsGpx } = useRealtimeNavigation();

// 獲取軌跡點
const trackPoints = getTrackPoints();
console.log('軌跡點數:', trackPoints.length);

// 導出為 GPX 格式
const gpxContent = exportTrackAsGpx();
// 保存或上傳 GPX 文件
```

## 完整屏幕示例

使用 `RealtimeNavigationScreen` 組件可以快速集成完整的導航界面：

```tsx
import { RealtimeNavigationScreen } from '@/components/realtime-navigation-screen';

function NavigationPage() {
  const route: NavigationRoute = {
    // ... 路線配置
  };

  return (
    <RealtimeNavigationScreen
      route={route}
      onNavigationComplete={() => {
        console.log('導航完成');
      }}
    />
  );
}
```

## 導航狀態接口

```typescript
interface NavigationState {
  isNavigating: boolean;              // 是否正在導航
  currentLocation: [number, number] | null;  // 當前位置 [緯度, 經度]
  currentStepIndex: number;           // 當前步驟索引
  totalSteps: number;                 // 總步驟數
  distanceToNextTurn: number;         // 距離下一轉彎的距離（米）
  distanceFromStart: number;          // 距離起點的距離（米）
  totalDistanceTraveled: number;      // 已騎行的總距離（米）
  isOffRoute: boolean;                // 是否偏離路線
  offRouteDistance: number;           // 偏離路線的距離（米）
  eta: number;                        // 預計到達時間（秒）
  currentSpeed: number;               // 當前速度（m/s）
  averageSpeed: number;               // 平均速度（m/s）
  elapsedTime: number;                // 已用時間（秒）
}
```

## 導航事件類型

```typescript
type NavigationEvent = 
  | { type: 'approaching-turn'; data: { instruction: any; distance: number } }
  | { type: 'immediate-turn'; data: { instruction: any; distance: number } }
  | { type: 'off-route'; data: { distance: number; location: [number, number] } }
  | { type: 'back-on-route'; data: { location: [number, number] } }
  | { type: 'step-completed'; data: { instruction: any; stepIndex: number } }
  | { type: 'navigation-complete'; data: { message: string } };
```

## 權限要求

應用需要以下權限才能正常運行：

### iOS
- `NSLocationWhenInUseUsageDescription` - 前台位置訪問
- `NSLocationAlwaysAndWhenInUseUsageDescription` - 背景位置訪問

### Android
- `android.permission.ACCESS_FINE_LOCATION` - 精確位置
- `android.permission.ACCESS_COARSE_LOCATION` - 粗略位置
- `android.permission.ACCESS_BACKGROUND_LOCATION` - 背景位置（可選）

## 性能優化

### 位置更新頻率
- 默認：5 秒或移動 10 米時更新
- 可根據需要調整 `LOCATION_UPDATE_INTERVAL` 常數

### 軌跡點優化
- 使用 Douglas-Peucker 算法簡化軌跡
- 可使用 `GpxOptimizer` 進行軌跡優化

### 內存管理
- 軌跡點存儲在內存中
- 對於長距離騎乘，建議定期保存軌跡到數據庫

## 測試

運行測試套件：

```bash
npm test -- realtime-navigation.test.ts
```

測試覆蓋：
- 初始化
- 導航狀態管理
- 事件發射
- 軌跡記錄
- 導航生命週期
- 距離計算
- 速度和時間追蹤
- 資源清理

## 常見問題

### Q: 如何在背景中繼續追蹤位置？
A: 使用 `expo-task-manager` 和 `expo-location` 的背景位置追蹤功能。詳見 `BackgroundStabilityManager`。

### Q: 如何提高位置精度？
A: 設置 `Location.Accuracy.Highest` 並增加更新頻率。注意這會增加電池消耗。

### Q: 如何處理沒有 GPS 信號的情況？
A: 系統會自動處理，`currentLocation` 會保持為 null，直到重新獲得信號。

### Q: 如何導出和保存騎乘記錄？
A: 使用 `exportTrackAsGpx()` 獲取 GPX 格式的軌跡，然後保存到文件或上傳到服務器。

## 集成檢查清單

- [ ] 添加位置權限到 `app.config.ts`
- [ ] 在應用根層級集成 `VoiceTurnNotificationProvider`
- [ ] 在導航屏幕中使用 `useRealtimeNavigation` Hook
- [ ] 配置路線信息和指令
- [ ] 測試位置追蹤功能
- [ ] 測試語音提示觸發
- [ ] 測試偏離路線檢測
- [ ] 測試軌跡導出功能
- [ ] 在實設備上進行端到端測試

## 相關文件

- `lib/realtime-navigation-manager.ts` - 核心管理器
- `hooks/use-realtime-navigation.ts` - React Hook
- `components/realtime-navigation-screen.tsx` - UI 組件
- `tests/realtime-navigation.test.ts` - 測試套件
- `lib/turn-by-turn-navigation.ts` - 轉向導航
- `lib/turn-voice-notification-manager.ts` - 語音提示
