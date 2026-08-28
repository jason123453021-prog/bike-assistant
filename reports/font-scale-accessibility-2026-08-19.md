# Android 字體縮放相容性記錄（130%／200%）

本次調整保留 React Native 的預設字體縮放行為，未以全域 `maxFontSizeMultiplier` 限制使用者的輔助功能設定。地圖騎乘儀表板會在 `fontScale >= 1.6` 時改為兩欄，並提高每格與底部面板的最小高度；130% 字體時也提高面板與欄位空間。導航橫幅、地址候選、釘選名稱、歷史/路線/活動名稱改為可換行，設定列、補給進度列、按鈕與輸入欄改用彈性寬度或最小高度。

新增 `tests/font-scale-accessibility-ui.test.ts`，鎖定 130%／200% 的兩欄儀表板、高度、可換行導航、設定列、名稱與補給輸入欄。完整回歸結果為 93 個測試檔、299 個測試通過。

> React Native `Text` 預設會遵循系統字體大小設定；官方文件說明 `numberOfLines` 會限制行數並可能觸發截斷，因此本次移除主要資訊列的單行限制，並讓容器自然增加高度。`

## 參考資料

[1] [React Native Text 官方文件](https://reactnative.dev/docs/text)
