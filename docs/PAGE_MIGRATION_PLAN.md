# 📋 UI 自適應規範頁面遷移計劃

## 一、頁面修復優先級

### 🔴 優先級 1：關鍵頁面（影響用戶體驗）

這些頁面包含底部按鈕或互動元素，必須優先修復。

| 頁面 | 文件路徑 | 問題 | 修復方案 |
|------|--------|------|--------|
| 權限設定 | `components/improved-permissions-onboarding-modal.tsx` | 底部「稍後設定」按鈕被遮擋 | ✅ 已修復（使用 useSafeAreaInsets） |
| 設定頁面 | `components/settings-screen-with-permissions.tsx` | 底部按鈕和開關需要動態邊距 | 待修復 |
| 導航頁面 | `app/(tabs)/navigate.tsx` | `content: { padding: 20, paddingBottom: 40 }` 固定邊距 | 待修復 |
| 地圖頁面 | `app/(tabs)/map.tsx` | 多個固定 paddingBottom（8、32、14） | 待修復 |
| 好友頁面 | `app/(tabs)/friends.tsx` | `contentContainerStyle={{ paddingBottom: 32 }}` 固定邊距 | 待修復 |
| 歷史頁面 | `app/(tabs)/history.tsx` | `listContent: { paddingBottom: 24 }` 固定邊距 | 待修復 |

### 🟡 優先級 2：次要頁面（需要修復）

這些頁面包含內部邊距，需要逐步修復。

| 頁面 | 文件路徑 | 問題 | 修復方案 |
|------|--------|------|--------|
| 首頁 | `app/(tabs)/index.tsx` | 檢查是否有固定底部邊距 | 待檢查 |
| 其他 Tab 頁面 | `app/(tabs)/*.tsx` | 檢查所有 Tab 頁面 | 待檢查 |
| 社群頁面 | `components/community-tab-integration.tsx` | 檢查是否有固定底部邊距 | 待檢查 |
| 用戶資料 | `components/user-profile-screen.tsx` | 檢查是否有固定底部邊距 | 待檢查 |

### 🟢 優先級 3：共用組件（已修復）

| 組件 | 文件路徑 | 狀態 |
|------|--------|------|
| ScreenContainer | `components/screen-container.tsx` | ✅ 已修復 |
| ImprovedPermissionsOnboardingModal | `components/improved-permissions-onboarding-modal.tsx` | ✅ 已修復 |

## 二、修復步驟

### 步驟 1：識別固定邊距

在每個頁面中搜索以下模式：

```tsx
// ❌ 需要修復的模式
paddingBottom: 32
marginBottom: 16
contentContainerStyle={{ paddingBottom: 24 }}
style={[styles.panel, { paddingBottom: 40 }]}
```

### 步驟 2：導入 Hook

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

### 步驟 3：計算動態邊距

```tsx
const insets = useSafeAreaInsets();
const bottomPadding = Math.max(insets.bottom, 16); // 16 為設計稿預設間距
```

### 步驟 4：應用動態邊距

```tsx
// ✅ 修復後的模式
paddingBottom: bottomPadding
marginBottom: Math.max(insets.bottom, 16)
contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 40) }]}
```

## 三、優先級 1 頁面詳細修復指南

### 3.1 導航頁面 (app/(tabs)/navigate.tsx)

**問題位置：**
```tsx
content: { padding: 20, paddingBottom: 40 },
```

**修復方案：**
```tsx
const insets = useSafeAreaInsets();

// 在 styles 中
content: { 
  padding: 20, 
  paddingBottom: Math.max(insets.bottom, 40) 
},
```

### 3.2 地圖頁面 (app/(tabs)/map.tsx)

**問題位置：**
```tsx
paddingBottom: insets.bottom + 8  // ✅ 已正確使用 insets
paddingBottom: 8
paddingBottom: 32
paddingBottom: 14
```

**修復方案：**
```tsx
const insets = useSafeAreaInsets();

// 保留已正確的用法
paddingBottom: insets.bottom + 8

// 修復其他位置
paddingBottom: Math.max(insets.bottom, 8)
paddingBottom: Math.max(insets.bottom, 32)
paddingBottom: Math.max(insets.bottom, 14)
```

### 3.3 好友頁面 (app/(tabs)/friends.tsx)

**問題位置：**
```tsx
contentContainerStyle={{ paddingBottom: 32 }}
paddingBottom: 12
paddingBottom: 32
```

**修復方案：**
```tsx
const insets = useSafeAreaInsets();

// 修復 ScrollView
contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}

// 修復其他位置
paddingBottom: Math.max(insets.bottom, 12)
paddingBottom: Math.max(insets.bottom, 32)
```

### 3.4 歷史頁面 (app/(tabs)/history.tsx)

**問題位置：**
```tsx
listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
```

**修復方案：**
```tsx
const insets = useSafeAreaInsets();

// 在 styles 中
listContent: { 
  paddingHorizontal: 16, 
  paddingTop: 12, 
  paddingBottom: Math.max(insets.bottom, 24) 
},
```

### 3.5 設定頁面 (components/settings-screen-with-permissions.tsx)

**問題位置：**
檢查是否有固定的底部邊距或按鈕容器

**修復方案：**
```tsx
const insets = useSafeAreaInsets();

// 所有底部容器都應使用
paddingBottom: Math.max(insets.bottom, 16)
```

## 四、PR 審查檢查清單

### 📋 UI 自適應規範檢查清單

在審查 PR 時，必須檢查以下項目：

#### 1. 底部元素檢查
- [ ] 所有底部按鈕都使用了 useSafeAreaInsets
- [ ] 所有 ScrollView 的 contentContainerStyle 包含動態 paddingBottom
- [ ] 所有 FlatList 的 contentContainerStyle 包含動態 paddingBottom
- [ ] 所有固定位置的容器（position: 'absolute'）考慮了 insets.bottom

#### 2. 禁止項檢查
- [ ] ❌ 沒有發現寫死的 marginBottom（除了內部間距）
- [ ] ❌ 沒有發現寫死的 paddingBottom（除了非底部容器）
- [ ] ❌ 沒有發現 hardcoded 的邊距值應用於底部容器

#### 3. 代碼質量檢查
- [ ] 使用了 Math.max(insets.bottom, 預設值) 的正確模式
- [ ] 導入了 useSafeAreaInsets Hook
- [ ] 在組件頂部調用了 Hook（不在條件語句中）

#### 4. 測試檢查
- [ ] 在 Android 虛擬按鍵設備上測試過
- [ ] 在 Android 手勢導航設備上測試過
- [ ] 在 iOS 有 Home Indicator 設備上測試過
- [ ] 在橫屏模式下測試過

#### 5. 文檔檢查
- [ ] 新組件的文檔中說明了防遮擋機制
- [ ] 如果有特殊的邊距計算，添加了註釋說明

### 使用方式

在 PR 審查時，複製以下清單到評論中：

```markdown
## UI 自適應規範檢查 ✅

### 底部元素檢查
- [ ] 所有底部按鈕都使用了 useSafeAreaInsets
- [ ] 所有 ScrollView 的 contentContainerStyle 包含動態 paddingBottom
- [ ] 所有 FlatList 的 contentContainerStyle 包含動態 paddingBottom

### 禁止項檢查
- [ ] ❌ 沒有發現寫死的 marginBottom
- [ ] ❌ 沒有發現寫死的 paddingBottom
- [ ] ❌ 沒有發現 hardcoded 的邊距值

### 代碼質量檢查
- [ ] 使用了 Math.max(insets.bottom, 預設值) 的正確模式
- [ ] 導入了 useSafeAreaInsets Hook

### 測試檢查
- [ ] 在 Android 虛擬按鍵設備上測試過
- [ ] 在 iOS 有 Home Indicator 設備上測試過

### 文檔檢查
- [ ] 新組件的文檔中說明了防遮擋機制
```

## 五、ESLint 規則建議

### 規則 1：禁止固定 marginBottom

```javascript
// .eslintrc.js 中添加自定義規則
{
  "rules": {
    "no-hardcoded-bottom-margin": {
      "meta": {
        "docs": {
          "description": "禁止在底部容器中使用固定的 marginBottom",
          "category": "Best Practices",
          "recommended": true
        }
      },
      "create": function(context) {
        return {
          "ObjectExpression": function(node) {
            node.properties.forEach(function(prop) {
              if (prop.key.name === 'marginBottom' && 
                  prop.value.type === 'Literal' &&
                  typeof prop.value.value === 'number') {
                context.report({
                  node: prop,
                  message: "避免使用固定的 marginBottom。請使用 Math.max(insets.bottom, 預設值) 代替。"
                });
              }
            });
          }
        };
      }
    }
  }
}
```

### 規則 2：禁止固定 paddingBottom

類似於上述規則，檢查 `paddingBottom`。

## 六、修復進度追蹤

### 修復狀態表

| 頁面 | 優先級 | 狀態 | 修復者 | 完成日期 |
|------|--------|------|--------|---------|
| 權限設定 | 1 | ✅ 已修復 | Manus | 2026-06-30 |
| 設定頁面 | 1 | ⏳ 待修復 | - | - |
| 導航頁面 | 1 | ⏳ 待修復 | - | - |
| 地圖頁面 | 1 | ⏳ 待修復 | - | - |
| 好友頁面 | 1 | ⏳ 待修復 | - | - |
| 歷史頁面 | 1 | ⏳ 待修復 | - | - |

## 七、修復完成後的驗收

### 驗收標準

- ✅ 所有優先級 1 頁面已修復
- ✅ 所有優先級 2 頁面已檢查並修復（如需要）
- ✅ 在多個設備上測試通過
- ✅ PR 審查檢查清單已集成到工作流程
- ✅ ESLint 規則已添加到項目
- ✅ 文檔已更新

### 測試清單

在發布前，必須在以下設備上測試：

- [ ] Android 虛擬按鍵設備（高度 ~48dp）
- [ ] Android 手勢導航設備（高度 ~72dp）
- [ ] Android 隱藏導覽列設備（高度 = 0）
- [ ] iOS 有 Home Indicator 設備（iPhone X+）
- [ ] iOS 無 Home Indicator 設備（iPhone 8）
- [ ] 橫屏模式下的所有頁面

---

**文檔版本**：1.0  
**最後更新**：2026-06-30  
**適用範圍**：所有 React Native 頁面  
**強制執行**：必須遵守
