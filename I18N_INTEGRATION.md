# i18n 國際化集成指南

## 概述

本應用程式已準備好國際化支援，支援以下語言：
- 繁體中文 (zh-TW)
- 簡體中文 (zh-CN)
- 英文 (en)

## 文件結構

```
bike_assistant/
├── locales/
│   ├── zh-TW.json          # 繁體中文翻譯
│   ├── zh-CN.json          # 簡體中文翻譯
│   └── en.json             # 英文翻譯
├── lib/
│   ├── i18n.ts             # 核心翻譯函數
│   └── i18n-context.tsx    # React Context 提供者
└── app/
    └── _layout.tsx         # 已集成 I18nProvider
```

## 使用方法

### 1. 在元件中使用翻譯

```tsx
import { useTranslation } from '@/lib/i18n-context';

export function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{t('supply.title')}</Text>
      <Text>{t('common.km')}</Text>
    </View>
  );
}
```

### 2. 使用變數替換

```tsx
const { t } = useTranslation();

// 翻譯文件中: "water_recommendation": "💧 建議一次補充 {{ml}} ml，小口慢飲效果更佳"
const message = t('supply.water_recommendation', { ml: 250 });
// 結果: "💧 建議一次補充 250 ml，小口慢飲效果更佳"
```

### 3. 獲取完整 i18n 上下文

```tsx
import { useI18n } from '@/lib/i18n-context';

export function LanguageSwitcher() {
  const { language, setLanguage, supportedLanguages } = useI18n();
  
  return (
    <View>
      {supportedLanguages.map(lang => (
        <Pressable
          key={lang}
          onPress={() => setLanguage(lang)}
          style={{ opacity: language === lang ? 1 : 0.5 }}
        >
          <Text>{lang}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

## 翻譯鍵結構

翻譯文件採用嵌套結構，使用點號分隔路徑：

```json
{
  "supply": {
    "title": "補給提醒",
    "energy": "補充能量",
    "water": "補充水分"
  }
}
```

使用時：`t('supply.title')` → "補給提醒"

## 添加新翻譯

1. 在所有三個翻譯文件中添加相同的鍵：

```json
// locales/zh-TW.json
{
  "myfeature": {
    "label": "我的功能"
  }
}

// locales/zh-CN.json
{
  "myfeature": {
    "label": "我的功能"
  }
}

// locales/en.json
{
  "myfeature": {
    "label": "My Feature"
  }
}
```

2. 在元件中使用：

```tsx
const { t } = useTranslation();
<Text>{t('myfeature.label')}</Text>
```

## 後續改進

### 1. 系統語言自動偵測
- 集成 `expo-localization` 以自動偵測系統語言
- 在 `lib/i18n.ts` 中的 `getSystemLanguage()` 函數實現

### 2. 語言切換 UI
- 在設定頁面添加語言選擇器
- 使用 `useI18n()` Hook 實現語言切換

### 3. 複數形式支援
- 添加複數形式處理（如 "1 次" vs "2 次"）
- 擴展翻譯函數以支援複數規則

### 4. 日期和時間本地化
- 集成 `date-fns` 或 `moment` 以本地化日期格式
- 根據語言調整時間格式

### 5. 數字格式本地化
- 實現數字格式化（小數點、千位分隔符）
- 根據語言調整單位顯示

## 翻譯完整性檢查

所有翻譯文件應包含相同的鍵集。可以編寫腳本驗證：

```bash
# 檢查翻譯鍵一致性
node scripts/validate-i18n.js
```

## 效能考慮

- 翻譯文件在應用啟動時加載
- 翻譯函數結果不被緩存（每次調用都重新查詢）
- 對於頻繁使用的翻譯，考慮在元件級別緩存結果

## 測試

建議為國際化功能編寫測試：

```tsx
import { t } from '@/lib/i18n';

describe('i18n', () => {
  it('should translate supply title', () => {
    expect(t('supply.title', 'zh-TW')).toBe('補給提醒');
    expect(t('supply.title', 'en')).toBe('Supply Reminder');
  });

  it('should replace variables', () => {
    const result = t('supply.water_recommendation', 'zh-TW', { ml: 250 });
    expect(result).toContain('250');
  });
});
```
