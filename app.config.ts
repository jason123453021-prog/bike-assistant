import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "com.jason123453021.bikeassistant";
const schemeFromBundleId = "manus20260617";

const env = {
  appName: "單車助手",
  appSlug: "bike-assistant",
  logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663766814562/BdbKiMdccrZSR9xLuck2qy/icon-5x7JypaRBZMZUk4remNAHQ.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
  // 隱私政策公開 URL（Google Play 上架必填）
  privacyPolicyUrl: "https://bikeassist-bdbkimdc.manus.space/privacy",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.3",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // iOS 位置權限說明（App Store 審查必填）
      NSLocationWhenInUseUsageDescription:
        "單車助手需要存取您的位置，以提供 GPS 導航、騎乘路線追蹤及好友位置共享功能。",
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
    versionCode: 4,
    edgeToEdgeEnabled: true,
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
      // 開機自啟：恢復背景服務
      "android.permission.RECEIVE_BOOT_COMPLETED",
      // 懸浮窗權限：顯示騎乘中的浮動提示
      "android.permission.SYSTEM_ALERT_WINDOW",
      // 電池最佳化白名單：確保背景位置追蹤不被系統中斷
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ],
    intentFilters: [
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
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    require("./plugins/with-foreground-service-plugin.js"),
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "單車助手需要位置權限以追蹤您的騎乘路線、提供 GPS 導航及好友位置共享功能。",
        locationWhenInUsePermission:
          "單車助手需要位置權限以追蹤您的騎乘路線及提供 GPS 導航功能。",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "單車助手需要麥克風權限以支援語音功能。",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
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
          minSdkVersion: 24,
          targetSdkVersion: 35,
          kotlinVersion: "2.0.20",
          enableProguardInReleaseBuilds: true,
          enableShrinkResources: true,
          enableDexingArtifactTransform: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
