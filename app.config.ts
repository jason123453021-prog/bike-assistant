import type { ExpoConfig } from "expo/config";

const bundleId = "com.jason123453021.bikeassistant";
const schemeFromBundleId = "manus20260617";
// 僅區分正式 AAB runtime version；所有 release 變體均啟用 R8 與資源縮減。
const isProductionEasBuild = process.env.EAS_BUILD_PROFILE === "production";

const env = {
  appName: "單車助手",
  appSlug: "bike-assistant",
  logoUrl:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/icon-5x7JypaRBZMZUk4remNAHQ.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
  // 隱私政策公開 URL（Google Play 上架必填）
  privacyPolicyUrl: "https://bikeassist-bdbkimdc.manus.space/privacy",
  // 僅用於每七天一次的已審核模型清單驗證；離線時不影響任何騎乘功能。
  modelUpdateManifestUrl:
    "https://bikeassist-bdbkimdc.manus.space/api/model-update/manifest",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  owner: "jason1234530",
  // Google Play 已使用 10105；本次更新使用下一個未使用的 versionCode 10106。
  version: "1.0.106",
  // Android 16 會忽略大螢幕的強制方向；改採自適應視窗與 Safe Area 佈局。
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  // Expo SDK 57 已預設採用 React Native 新架構；未加入任何自訂 NitroModules 或 C++ 原生模組。
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // iOS 位置權限說明（App Store 審查必填）
      NSLocationWhenInUseUsageDescription:
        "單車助手需要存取您的位置，以提供 GPS 導航、速度計算及騎乘路線追蹤功能。",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "單車助手需要在背景存取您的位置，以便在螢幕關閉時持續追蹤騎乘路線並更新通知欄資訊。",
      NSLocationAlwaysUsageDescription:
        "單車助手需要在背景存取您的位置，以便在螢幕關閉時持續追蹤騎乘路線並更新通知欄資訊。",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0D0D0D",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    versionCode: 10106,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    // Google Play 資料安全表單所需的隱私政策 URL：
    // https://bikeassist-bdbkimdc.manus.space/privacy
    permissions: [
      // 精確 GPS 位置：提供導航、速度計算、路線追蹤
      "android.permission.ACCESS_FINE_LOCATION",
      // 概略位置：作為精確位置的備用
      "android.permission.ACCESS_COARSE_LOCATION",
      // 背景位置：騎乘中螢幕關閉時持續追蹤路線
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      // 前台服務：顯示騎乘中的持續通知（速度、距離、時間）
      "android.permission.FOREGROUND_SERVICE",
      // 前台服務位置類型：Android 14+ 必填
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      // 推播通知：騎乘提醒、補給提醒
      "android.permission.POST_NOTIFICATIONS",
      // 震動：觸覺回饋
      "android.permission.VIBRATE",
      // 喚醒鎖：防止 GPS 追蹤被系統中斷
      "android.permission.WAKE_LOCK",
      // 電池最佳化白名單：確保背景位置追蹤不被系統中斷
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ],
    // 套件若宣告開機接收或懸浮窗，均從最終 manifest 明確移除：本 App 僅由使用者開始騎乘後啟動 location 前景服務。
    blockedPermissions: [
      "android.permission.RECEIVE_BOOT_COMPLETED",
      // App 僅播放本機提示音，沒有錄音或語音上傳功能。
      "android.permission.RECORD_AUDIO",
    ],
    intentFilters: [
      {
        action: "VIEW",
        data: [
          { scheme: "content", mimeType: "application/gpx+xml" },
          {
            scheme: "content",
            mimeType: "application/xml",
            pathPattern: ".*\\.gpx",
          },
          { scheme: "content", mimeType: "text/xml", pathPattern: ".*\\.gpx" },
          {
            scheme: "content",
            mimeType: "application/octet-stream",
            pathPattern: ".*\\.gpx",
          },
          { scheme: "file", mimeType: "application/gpx+xml" },
          {
            scheme: "file",
            mimeType: "application/octet-stream",
            pathPattern: ".*\\.gpx",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: env.scheme, host: "*" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    // 本 App 的主要目標為 Android；以單頁模式提供管理預覽，
    // 避免靜態 SSR 與 Expo Go Android bundle 同時建立大型 Metro 圖譜。
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  // 此 Local-First App 的正式 AAB 僅隨安裝包更新；不向 Expo Updates 請求或套用 OTA bundle。
  // Expo Go 的 Metro development bundle 下載是獨立流程，並不受這個正式版設定控制。
  updates: {
    enabled: false,
    checkAutomatically: "NEVER",
  },
  plugins: [
    "expo-router",
    "expo-localization",
    [
      "expo-notifications",
      {
        // 所有本機補給提醒會明確指定 supply；此處提供原生 fallback，避免未指定頻道時退回系統預設頻道。
        defaultChannel: "supply",
        enableBackgroundRemoteNotifications: false,
      },
    ],
    "expo-font",
    "expo-asset",
    // Expo SDK 57 將這些原生模組明確列為 config plugins，避免依賴隱式設定。
    "expo-image",
    "expo-sharing",
    "expo-status-bar",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "單車助手需要位置權限以追蹤您的騎乘路線，並在螢幕關閉時持續完成本機紀錄。",
        locationWhenInUsePermission:
          "單車助手需要位置權限以追蹤您的騎乘路線及提供 GPS 導航功能。",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    // 僅使用播放器播放本機提示音；沒有錄音、語音輸入或麥克風資料處理。
    "expo-audio",
    [
      "expo-image-picker",
      {
        photosPermission:
          "單車助手僅在您主動選取時讀取相片，以加入本機騎乘時間軸。",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0D0D0D",
        dark: {
          backgroundColor: "#0D0D0D",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          // Google Play 的合規條件是 target SDK，而非 min SDK。
          // 明確設定 compile／target 為 Android 16 (API 36)，並保留 Android 7+ 安裝相容性。
          buildToolsVersion: "36.0.0",
          compileSdkVersion: 36,
          minSdkVersion: 24,
          targetSdkVersion: 36,
          // 所有 release 變體皆啟用 R8 與資源縮減；debug 不受影響。
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    // 保留 app 內本機通知與 Task Manager 事件，但不允許任何套件在裝置開機時重啟服務。
    // 此 plugin 必須位於 Expo 內建 plugin 之後，才能從最終 Android manifest 移除 BOOT_COMPLETED 類 action。
    "./plugins/with-remove-boot-completed-receivers.cjs",
    // Expo 範本預設使用非最佳化的 ProGuard 規則；在原生專案生成後切換為 R8 最佳化規則。
    "./plugins/with-android-release-optimization.cjs",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },
  extra: {
    modelUpdateManifestUrl: env.modelUpdateManifestUrl,
    // 僅 GitHub Android Emulator E2E release build 會啟用，正式發行版不可使用這個驗收入口。
    e2eNotificationHarness: process.env.E2E_NOTIFICATION_HARNESS === "true",
    eas: {
      projectId: "af286610-25f1-45e5-afcc-6c30040d4124",
    },
  },
  // 正式 AAB 與 EAS Update 使用固定 runtime；Expo Go 開發 manifest 則採 SDK 相容 runtime，
  // 避免 Expo Go 將正式版 1.0.95 當成不相容的已安裝原生 runtime 而拒絕下載遠端 bundle。
  runtimeVersion: isProductionEasBuild ? "1.0.106" : undefined,
};

export default config;
