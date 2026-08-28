# 手機可操作的雲端 APK 建置方案調查

調查日期：2026-08-15

## 結論

沒有能將既有 Expo 專案「直接上傳、零設定、永久免費」並自動產生可發佈 APK 的可靠服務。所有合法 Android APK 發佈流程仍需要：可存取的原始碼來源、雲端建置設定，以及 Android 簽章憑證。現有專案採用動態 `app.config.ts` 與自訂 Expo plugins，因此候選 CI 都需要從 Git repository 讀取完整原始碼並於雲端執行 Expo prebuild。

| 服務 | 官方免費額度／限制 | 與現有 Expo 專案的關係 | 手機操作可行性 |
|---|---|---|---|
| Codemagic | 個人帳戶每月 500 免費建置分鐘，單一並行作業 | 官方文件說明可在建置機上執行 `npx expo prebuild` 後以 Gradle 建置 | 可用手機瀏覽器設定，但需要可存取的 Git repository 與一次性簽章設定 |
| Bitrise Hobby | 免費層提供每月 300 credits、1 個私有 app，單次建置上限 90 分鐘 | 官方文件可辨識 `app.config.ts` Expo 專案，並支援 Android APK artifact 與 keystore 管理 | 可用手機瀏覽器設定，但同樣需要 Git repository 與 keystore |
| GitHub Actions | 公開 repository 的標準 runner 免費；GitHub Free 私有 repository 每月 2,000 分鐘 | 可自行在 Ubuntu runner 執行 Expo prebuild、Gradle 與 artifact upload | 免費彈性最高，但需要設定 workflow、GitHub secrets 與 Android 簽章 |
| Expo EAS | 本次受 EAS project:init 服務端帳戶關聯問題阻斷 | 原生適配度最高，但仍依賴有效 Expo 帳戶、projectId 與建置憑證 | 目前不適合作為可立即使用的方案 |

## 不可省略的安全項目

1. Android 可安裝或上架的 release APK 必須由 keystore 簽署。
2. Keystore、密碼、Expo Token、CI token 不可加入 repository，不可貼到聊天，僅能放進 CI 的 encrypted secrets 或 code-signing storage。
3. 若只想自行實機測試，也可使用 CI 自動產生測試用簽章 APK；Google Play 正式上架仍需長期保存同一把 upload keystore。

## 官方參考

- Codemagic React Native/Expo：<https://docs.codemagic.io/yaml-quick-start/building-a-react-native-app/>
- Codemagic 價格：<https://codemagic.io/pricing/>
- Bitrise React Native/Expo：<https://docs.bitrise.io/en/bitrise-ci/getting-started/quick-start-guides/getting-started-with-react-native-projects>
- Bitrise 價格：<https://bitrise.io/pricing>
- GitHub Actions 計費：<https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions>
