# 📌 全域 UI 自適應與系統導覽列（海帶條）防遮擋規範

## 一、核心問題與根因分析

### 問題描述
在 Android 裝置上，系統底部的導覽列（虛擬按鍵/全螢幕手勢海帶條）高度會因手機廠牌、型號及使用者設定而有巨大差異。若開發時針對底部按鈕或容器使用「寫死的固定邊距（Hardcoded Margin/Padding）」，App 將無法感知系統 UI 的存在，導致最底層的互動元件被系統導覽列覆蓋，造成無法點擊的嚴重體驗缺陷。

### 根因分析
1. **系統導覽列高度不一致**：不同 Android 設備的導覽列高度不同（通常 48-72dp）
2. **固定邊距無法適應**：寫死的 marginBottom 無法動態感知系統 UI
3. **跨平台差異**：iOS 的 Home Indicator、Android 的虛擬按鍵存在差異
4. **用戶設定變化**：用戶可隱藏或顯示導覽列，導致高度動態變化

### 影響範圍
- 所有貼底的互動元件（按鈕、輸入框、浮動選單）
- 全屏模式下的底部容器
- Modal/Sheet 組件的底部操作區
- Tab Bar 下方的內容區

## 二、全域開發規範與解決方案

### 2.1 全面禁用寫死邊距

**❌ 禁止做法**
```tsx
// 錯誤：固定邊距無法適應系統導覽列
<View style={{ marginBottom: 16 }}>
  <Button title="確定" />
</View>

// 錯誤：寫死的 paddingBottom
<ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
  {/* 內容 */}
</ScrollView>
```

**✅ 正確做法**
```tsx
// 正確：使用動態計算的邊距
const insets = useSafeAreaInsets();
<View style={{ marginBottom: Math.max(insets.bottom, 16) }}>
  <Button title="確定" />
</View>
```

### 2.2 強制導入 Safe Area 偵測

所有頁面佈局必須依賴 `react-native-safe-area-context` 庫來獲取螢幕的安全可視範圍。

**導入方式**
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MyComponent() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }}>
      {/* 內容 */}
    </View>
  );
}
```

### 2.3 動態高度補償公式（Dynamic Padding）

底部容器的樣式必須透過 Hook (useSafeAreaInsets) 動態獲取系統導覽列的真實像素高度，並使用 Math.max() 結合設計稿的預設間距進行安全推展。

**實作標準邏輯**
```tsx
const insets = useSafeAreaInsets();
const bottomPadding = Math.max(insets.bottom, 16); // 16 為設計稿預設間距

<View style={{ paddingBottom: bottomPadding }}>
  {/* 底部按鈕或容器 */}
</View>
```

**運作原理**
- 若系統有海帶條（insets.bottom > 0），按鈕會自動往上推展該高度
- 若系統無海帶條（如某些隱藏手勢設定），則維持設計稿的預設美觀間距
- Math.max() 確保最小間距不會小於設計稿要求

### 2.4 共用組件層級實作

在共用組件（Common Components）的層級落實這個知識點的邏輯，未來所有新開發的頁面就能自動繼承這個防遮擋機制。

**ScreenContainer 改進範例**
```tsx
import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
  bottomPaddingOverride?: number; // 允許覆蓋預設間距
}

export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  className,
  containerClassName,
  safeAreaClassName,
  bottomPaddingOverride,
  style,
  ...props
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  
  // 動態計算底部邊距
  const bottomPadding = bottomPaddingOverride 
    ? Math.max(insets.bottom, bottomPaddingOverride)
    : insets.bottom;

  return (
    <View
      className={cn('flex-1', 'bg-background', containerClassName)}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn('flex-1', safeAreaClassName)}
        style={[style, { paddingBottom: bottomPadding }]}
      >
        <View className={cn('flex-1', className)}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}
```

## 三、具體實作清單

### 3.1 頁面級別檢查清單

所有新開發的頁面必須檢查以下項目：

- [ ] 使用 ScreenContainer 包裝頁面內容
- [ ] 所有底部按鈕/容器使用 useSafeAreaInsets 計算邊距
- [ ] 禁止使用固定的 marginBottom 或 paddingBottom
- [ ] Modal/Sheet 的底部操作區使用動態邊距
- [ ] ScrollView 的 contentContainerStyle 包含動態底部邊距
- [ ] FlatList 的 contentContainerStyle 包含動態底部邊距

### 3.2 組件級別檢查清單

所有共用組件必須檢查以下項目：

- [ ] 底部操作按鈕使用 useSafeAreaInsets
- [ ] 浮動按鈕/FAB 考慮系統導覽列高度
- [ ] Bottom Sheet/Modal 的底部邊距動態計算
- [ ] 固定位置的容器（position: 'absolute'）考慮 insets.bottom
- [ ] 文檔中明確標註該組件已遵守防遮擋規範

### 3.3 測試清單

在發布前必須在以下設備上測試：

- [ ] Android 虛擬按鍵設備（高度 ~48dp）
- [ ] Android 手勢導航設備（高度 ~72dp）
- [ ] Android 隱藏導覽列設備（高度 = 0）
- [ ] iOS 有 Home Indicator 設備（iPhone X+）
- [ ] iOS 無 Home Indicator 設備（iPhone 8）
- [ ] 橫屏模式下的底部邊距

## 四、預期驗收標準

導入此知識點後，無論使用者使用何種 Android 裝置、是否開啟三鍵式虛擬導航列，或是切換至 iOS 裝置的 Home Indicator，App 的所有底部按鈕與互動區塊均能自動向上浮動適應，達到以下標準：

### 驗收指標
- ✅ **100% 零遮擋**：底部按鈕永不被系統導覽列覆蓋
- ✅ **完全可點擊**：所有底部互動元件都能正常點擊
- ✅ **視覺美觀**：在不同設備上保持一致的設計美感
- ✅ **自動適應**：無需手動調整，自動適應系統 UI 變化
- ✅ **跨平台一致**：iOS 和 Android 表現一致

### 測試方法
```tsx
// 測試組件：驗證底部按鈕是否被遮擋
export function SafeAreaTestComponent() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <Text>insets.bottom: {insets.bottom}px</Text>
      <View style={{ flex: 1 }} />
      
      {/* 底部按鈕 - 應該完全可見和可點擊 */}
      <Pressable
        style={{
          backgroundColor: '#007AFF',
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginBottom: Math.max(insets.bottom, 16),
          borderRadius: 8,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          測試按鈕 - 應該完全可見
        </Text>
      </Pressable>
    </View>
  );
}
```

## 五、常見問題與解答

### Q1: 為什麼不能使用固定邊距？
**A:** 固定邊距無法感知系統導覽列的動態高度變化。不同設備的導覽列高度差異大（0-72dp），固定值會導致某些設備上按鈕被遮擋。

### Q2: useSafeAreaInsets 在 Web 上會返回什麼？
**A:** 在 Web 上，useSafeAreaInsets 通常返回 { top: 0, bottom: 0, left: 0, right: 0 }。使用 Math.max() 確保設計稿預設間距被保留。

### Q3: 如何處理橫屏模式？
**A:** useSafeAreaInsets 會自動根據屏幕方向更新。在橫屏模式下，insets.left 和 insets.right 可能會增加（因為系統導覽列在側邊）。

### Q4: Modal/Sheet 需要特別處理嗎？
**A:** 是的。Modal 的底部操作區應該使用相同的動態邊距邏輯。如果 Modal 是全屏的，應該在 Modal 內部使用 ScreenContainer。

### Q5: 如何向後相容舊代碼？
**A:** 逐步遷移。優先修復影響用戶體驗的頁面（如設定頁面），然後逐步應用到其他頁面。新代碼必須遵守此規範。

## 六、實作範例

### 範例 1：底部按鈕列
```tsx
import { View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function BottomButtonBar() {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 16),
        gap: 8,
      }}
    >
      <Pressable style={{ backgroundColor: '#007AFF', padding: 12 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>確定</Text>
      </Pressable>
      <Pressable style={{ backgroundColor: '#ccc', padding: 12 }}>
        <Text style={{ textAlign: 'center' }}>取消</Text>
      </Pressable>
    </View>
  );
}
```

### 範例 2：ScrollView 內容
```tsx
import { ScrollView, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ScrollableContent() {
  const insets = useSafeAreaInsets();
  
  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 16),
      }}
    >
      {/* 內容 */}
    </ScrollView>
  );
}
```

### 範例 3：固定位置的浮動按鈕
```tsx
import { View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FloatingActionButton() {
  const insets = useSafeAreaInsets();
  
  return (
    <Pressable
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 16) + 16, // 額外的 16 是設計間距
        right: 16,
        backgroundColor: '#007AFF',
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: 'white', fontSize: 24 }}>+</Text>
    </Pressable>
  );
}
```

## 七、團隊交接指南

### 給開發團隊的建議
1. **立即行動**：在所有新開發的頁面中應用此規範
2. **逐步遷移**：優先修復影響用戶體驗的現有頁面
3. **代碼審查**：在 PR 審查時檢查是否遵守此規範
4. **文檔更新**：將此規範添加到開發指南中
5. **自動化檢查**：考慮添加 ESLint 規則檢查固定邊距的使用

### 檢查清單（用於 PR 審查）
- [ ] 頁面使用了 ScreenContainer 或 SafeAreaView
- [ ] 所有底部元素使用了 useSafeAreaInsets
- [ ] 沒有發現固定的 marginBottom 或 paddingBottom
- [ ] 在多個設備上測試過（至少 Android 和 iOS）
- [ ] 文檔中標註了此組件已遵守防遮擋規範

---

**文檔版本**：1.0  
**最後更新**：2026-06-30  
**適用範圍**：所有 React Native 頁面和組件  
**強制執行**：必須遵守
