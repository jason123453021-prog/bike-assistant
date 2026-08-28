# 📋 PR 審查檢查清單 - UI 自適應規範

## 概述

此檢查清單用於確保所有新代碼都遵守全域 UI 自適應與系統導覽列防遮擋規範。在審查任何涉及 UI 的 PR 時，必須檢查以下項目。

**相關文檔：**
- [UI_SAFE_AREA_KNOWLEDGE_POINT.md](./UI_SAFE_AREA_KNOWLEDGE_POINT.md) - 核心規範
- [PAGE_MIGRATION_PLAN.md](./PAGE_MIGRATION_PLAN.md) - 頁面遷移計劃

---

## 📋 完整 PR 審查檢查清單

### 1️⃣ 底部元素檢查

在審查 PR 時，檢查以下項目：

#### 1.1 底部按鈕和互動元素

```tsx
// ❌ 需要修復
<View style={{ marginBottom: 16 }}>
  <Button title="確定" />
</View>

// ✅ 正確做法
const insets = useSafeAreaInsets();
<View style={{ marginBottom: Math.max(insets.bottom, 16) }}>
  <Button title="確定" />
</View>
```

**檢查項：**
- [ ] 所有底部按鈕都使用了 useSafeAreaInsets
- [ ] 使用了 Math.max(insets.bottom, 預設值) 的模式
- [ ] 沒有寫死的 marginBottom 或 paddingBottom

#### 1.2 ScrollView 和 FlatList

```tsx
// ❌ 需要修復
<ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
  {/* 內容 */}
</ScrollView>

// ✅ 正確做法
const insets = useSafeAreaInsets();
<ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}>
  {/* 內容 */}
</ScrollView>
```

**檢查項：**
- [ ] ScrollView 的 contentContainerStyle 包含動態 paddingBottom
- [ ] FlatList 的 contentContainerStyle 包含動態 paddingBottom
- [ ] 沒有寫死的邊距值

#### 1.3 固定位置的容器

```tsx
// ❌ 需要修復
<View style={{ position: 'absolute', bottom: 16 }}>
  {/* 浮動按鈕 */}
</View>

// ✅ 正確做法
const insets = useSafeAreaInsets();
<View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 16) }}>
  {/* 浮動按鈕 */}
</View>
```

**檢查項：**
- [ ] 所有固定位置的容器考慮了 insets.bottom
- [ ] 使用了正確的 Math.max 模式

#### 1.4 Modal 和 Sheet

```tsx
// ❌ 需要修復
<Modal>
  <View style={{ paddingBottom: 20 }}>
    <Button title="確定" />
  </View>
</Modal>

// ✅ 正確做法
const insets = useSafeAreaInsets();
<Modal>
  <View style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
    <Button title="確定" />
  </View>
</Modal>
```

**檢查項：**
- [ ] Modal 的底部操作區使用了動態邊距
- [ ] Sheet 的底部容器使用了動態邊距

---

### 2️⃣ 禁止項檢查

#### 2.1 禁止寫死的 marginBottom

```tsx
// ❌ 禁止
marginBottom: 16
marginBottom: 20
marginBottom: 32
```

**檢查方法：**
```bash
# 在 PR 中搜索
grep -n "marginBottom.*:" <file>
```

**檢查項：**
- [ ] ❌ 沒有發現寫死的 marginBottom（除了內部間距）
- [ ] ❌ 所有底部容器的 marginBottom 都使用了 insets.bottom

#### 2.2 禁止寫死的 paddingBottom

```tsx
// ❌ 禁止
paddingBottom: 24
paddingBottom: 32
paddingBottom: 40
```

**檢查方法：**
```bash
# 在 PR 中搜索
grep -n "paddingBottom.*:" <file>
```

**檢查項：**
- [ ] ❌ 沒有發現寫死的 paddingBottom（除了非底部容器）
- [ ] ❌ 所有底部容器的 paddingBottom 都使用了 insets.bottom

#### 2.3 禁止 hardcoded 的邊距值

```tsx
// ❌ 禁止
style={{ paddingBottom: 40 }}
style={[styles.panel, { paddingBottom: 32 }]}
contentContainerStyle={{ paddingBottom: 24 }}
```

**檢查項：**
- [ ] ❌ 沒有發現 hardcoded 的邊距值應用於底部容器

---

### 3️⃣ 代碼質量檢查

#### 3.1 Hook 導入

```tsx
// ✅ 正確
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MyComponent() {
  const insets = useSafeAreaInsets();
  // ...
}
```

**檢查項：**
- [ ] 導入了 useSafeAreaInsets Hook
- [ ] 在組件頂部調用了 Hook（不在條件語句中）
- [ ] Hook 調用位置正確（不在循環或條件中）

#### 3.2 Math.max 模式

```tsx
// ✅ 正確的模式
const bottomPadding = Math.max(insets.bottom, 16);
paddingBottom: Math.max(insets.bottom, 16)
marginBottom: Math.max(insets.bottom, 16)
```

**檢查項：**
- [ ] 使用了 Math.max(insets.bottom, 預設值) 的正確模式
- [ ] 預設值與設計稿一致
- [ ] 沒有使用其他計算方式

#### 3.3 變量命名

```tsx
// ✅ 推薦的命名
const insets = useSafeAreaInsets();
const bottomPadding = Math.max(insets.bottom, 16);
const bottomMargin = Math.max(insets.bottom, 20);
```

**檢查項：**
- [ ] 變量命名清晰易懂
- [ ] 使用了 insets 而不是其他名稱

#### 3.4 代碼註釋

```tsx
// ✅ 推薦添加註釋
const insets = useSafeAreaInsets();

// 動態計算底部邊距以防止 UI 被系統導覽列遮擋
const bottomPadding = Math.max(insets.bottom, 16);

<View style={{ paddingBottom: bottomPadding }}>
  {/* 內容 */}
</View>
```

**檢查項：**
- [ ] 如果邏輯不明顯，添加了註釋說明
- [ ] 註釋清晰簡潔

---

### 4️⃣ 測試檢查

#### 4.1 Android 測試

```
測試設備類型：
- [ ] Android 虛擬按鍵設備（高度 ~48dp）
- [ ] Android 手勢導航設備（高度 ~72dp）
- [ ] Android 隱藏導覽列設備（高度 = 0）
```

**檢查項：**
- [ ] 在 Android 虛擬按鍵設備上測試過
- [ ] 在 Android 手勢導航設備上測試過
- [ ] 在 Android 隱藏導覽列設備上測試過
- [ ] 底部元素完全可見和可點擊

#### 4.2 iOS 測試

```
測試設備類型：
- [ ] iOS 有 Home Indicator 設備（iPhone X+）
- [ ] iOS 無 Home Indicator 設備（iPhone 8）
```

**檢查項：**
- [ ] 在 iOS 有 Home Indicator 設備上測試過
- [ ] 在 iOS 無 Home Indicator 設備上測試過
- [ ] 底部元素完全可見和可點擊

#### 4.3 屏幕方向測試

```
測試方向：
- [ ] 豎屏模式（Portrait）
- [ ] 橫屏模式（Landscape）
```

**檢查項：**
- [ ] 在豎屏模式下測試過
- [ ] 在橫屏模式下測試過
- [ ] 屏幕旋轉時邊距動態更新

#### 4.4 邊界情況測試

```
邊界情況：
- [ ] 系統導覽列隱藏時（insets.bottom = 0）
- [ ] 系統導覽列顯示時（insets.bottom > 0）
- [ ] 動態改變導覽列設置時
```

**檢查項：**
- [ ] 測試了系統導覽列隱藏的情況
- [ ] 測試了系統導覽列顯示的情況
- [ ] 邊距計算正確

---

### 5️⃣ 文檔檢查

#### 5.1 代碼文檔

```tsx
/**
 * 一個自動適應系統導覽列的容器組件。
 * 
 * 此組件遵守全域 UI 自適應規範，自動計算底部邊距
 * 以防止 UI 被系統導覽列遮擋。
 * 
 * 參考：docs/UI_SAFE_AREA_KNOWLEDGE_POINT.md
 */
export function MyContainer() {
  const insets = useSafeAreaInsets();
  // ...
}
```

**檢查項：**
- [ ] 新組件的文檔中說明了防遮擋機制
- [ ] 文檔中引用了相關的知識點文檔
- [ ] 文檔清晰易懂

#### 5.2 提交信息

```
✅ 正確的提交信息

feat: 修復導航頁面底部按鈕被系統導覽列遮擋的問題

- 使用 useSafeAreaInsets 動態計算底部邊距
- 將固定的 paddingBottom: 40 改為 Math.max(insets.bottom, 40)
- 在 Android 虛擬按鍵和手勢導航設備上測試通過

參考：docs/UI_SAFE_AREA_KNOWLEDGE_POINT.md
```

**檢查項：**
- [ ] 提交信息清晰說明了修復內容
- [ ] 提交信息中提到了相關文檔
- [ ] 提交信息中說明了測試情況

#### 5.3 PR 描述

```markdown
## 修復內容

修復導航頁面底部按鈕被系統導覽列遮擋的問題。

## 修改文件

- app/(tabs)/navigate.tsx

## 修改詳情

- 使用 useSafeAreaInsets Hook 動態計算底部邊距
- 將固定的 paddingBottom: 40 改為 Math.max(insets.bottom, 40)

## 測試

- [x] Android 虛擬按鍵設備
- [x] Android 手勢導航設備
- [x] iOS 有 Home Indicator 設備
- [x] 橫屏模式

## 參考

- docs/UI_SAFE_AREA_KNOWLEDGE_POINT.md
- docs/PAGE_MIGRATION_PLAN.md
```

**檢查項：**
- [ ] PR 描述清晰說明了修復內容
- [ ] PR 描述中提到了測試情況
- [ ] PR 描述中引用了相關文檔

---

## 🎯 快速檢查清單

在審查 PR 時，快速檢查以下項目：

```markdown
## UI 自適應規範快速檢查 ✅

### 底部元素
- [ ] 所有底部按鈕都使用了 useSafeAreaInsets
- [ ] 所有 ScrollView/FlatList 的 contentContainerStyle 包含動態 paddingBottom

### 禁止項
- [ ] ❌ 沒有發現寫死的 marginBottom
- [ ] ❌ 沒有發現寫死的 paddingBottom

### 代碼質量
- [ ] 使用了 Math.max(insets.bottom, 預設值) 的正確模式
- [ ] 導入了 useSafeAreaInsets Hook

### 測試
- [ ] 在 Android 虛擬按鍵設備上測試過
- [ ] 在 iOS 有 Home Indicator 設備上測試過
- [ ] 在橫屏模式下測試過

### 文檔
- [ ] 新組件的文檔中說明了防遮擋機制
- [ ] PR 描述中提到了測試情況
```

---

## 📝 使用方式

### 方式 1：複製到 PR 評論

在審查 PR 時，複製上述檢查清單到評論中，逐項檢查。

### 方式 2：集成到 GitHub Actions

創建自動檢查工作流程：

```yaml
# .github/workflows/ui-safe-area-check.yml
name: UI Safe Area Check

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check for hardcoded margins
        run: |
          grep -r "marginBottom.*: [0-9]" app/ components/ || echo "✅ No hardcoded marginBottom found"
          grep -r "paddingBottom.*: [0-9]" app/ components/ || echo "✅ No hardcoded paddingBottom found"
```

### 方式 3：集成到 ESLint

添加自定義 ESLint 規則檢查固定邊距。

---

## 🔗 相關資源

- [UI_SAFE_AREA_KNOWLEDGE_POINT.md](./UI_SAFE_AREA_KNOWLEDGE_POINT.md) - 核心規範
- [PAGE_MIGRATION_PLAN.md](./PAGE_MIGRATION_PLAN.md) - 頁面遷移計劃
- [react-native-safe-area-context 文檔](https://github.com/th3rdwave/react-native-safe-area-context)

---

**文檔版本**：1.0  
**最後更新**：2026-06-30  
**適用範圍**：所有 PR 審查  
**強制執行**：必須遵守
