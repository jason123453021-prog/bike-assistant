const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Config Plugin: with-foreground-service-plugin
 * 
 * 功能：
 * 1. 在 AndroidManifest.xml 中添加 Foreground Service 權限
 * 2. 配置 LocationForegroundService（Android 15 相容）
 * 3. 配置 ScreenWakeupActivity
 * 4. 添加 WAKE_LOCK 權限
 * 5. 移除 BOOT_COMPLETED 廣播接收器（改用 WorkManager）
 * 6. 移除已淘汰的 LAYOUT_IN_DISPLAY_CUTOUT_MODE 屬性（Android 15+）
 */
module.exports = function withForegroundServicePlugin(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // 確保 manifest 結構存在
    if (!androidManifest.manifest) {
      androidManifest.manifest = {};
    }

    // 添加 uses-permission
    if (!androidManifest.manifest["uses-permission"]) {
      androidManifest.manifest["uses-permission"] = [];
    }

    const permissions = [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.WAKE_LOCK",
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ];

    // 添加缺失的權限
    permissions.forEach((permission) => {
      const exists = androidManifest.manifest["uses-permission"].some(
        (p) => p.$["android:name"] === permission
      );

      if (!exists) {
        androidManifest.manifest["uses-permission"].push({
          $: { "android:name": permission },
        });
      }
    });

    // 添加 application 配置
    if (!androidManifest.manifest.application) {
      androidManifest.manifest.application = [];
    }

    const application = androidManifest.manifest.application[0];

    // 添加 LocationForegroundService
    if (!application.service) {
      application.service = [];
    }

    const locationServiceExists = application.service.some(
      (s) => s.$["android:name"] === "com.jason123453021.bikeassistant.LocationForegroundService"
    );

    if (!locationServiceExists) {
      application.service.push({
        $: {
          "android:name": "com.jason123453021.bikeassistant.LocationForegroundService",
          "android:enabled": "true",
          "android:exported": "false",
          "android:foregroundServiceType": "location",
          "android:permission": "android.permission.FOREGROUND_SERVICE_LOCATION",
        },
      });
    }

    // 移除舊的 BOOT_COMPLETED 廣播接收器（改用 WorkManager）
    if (application.receiver) {
      application.receiver = application.receiver.filter(
        (r) => {
          const intentFilters = r["intent-filter"] || [];
          return !intentFilters.some(
            (filter) => filter.action?.some(
              (action) => action.$["android:name"] === "android.intent.action.BOOT_COMPLETED"
            )
          );
        }
      );
    }

    // 添加 ScreenWakeupActivity
    if (!application.activity) {
      application.activity = [];
    }

    const screenWakeupActivityExists = application.activity.some(
      (a) => a.$["android:name"] === "com.jason123453021.bikeassistant.ScreenWakeupActivity"
    );

    if (!screenWakeupActivityExists) {
      application.activity.push({
        $: {
          "android:name": "com.jason123453021.bikeassistant.ScreenWakeupActivity",
          "android:enabled": "true",
          "android:exported": "false",
          "android:showWhenLocked": "true",
          "android:turnScreenOn": "true",
          "android:resizeableActivity": "true",
        },
      });
    }

    // 添加屏幕尺寸支持配置
    if (!androidManifest.manifest["supports-screens"]) {
      androidManifest.manifest["supports-screens"] = [
        {
          $: {
            "android:smallScreens": "true",
            "android:normalScreens": "true",
            "android:largeScreens": "true",
            "android:xlargeScreens": "true",
            "android:resizeable": "true",
            "android:anyDensity": "true",
          },
        },
      ];
    }

    // Android 15+ 無邊框配置：移除已淘汰的 LAYOUT_IN_DISPLAY_CUTOUT_MODE
    // 在 Android 15 中，系統會自動處理無邊框繪製
    if (application.activity) {
      application.activity.forEach((activity) => {
        // 移除已淘汰的 android:windowLayoutInDisplayCutoutMode 屬性
        if (activity["meta-data"]) {
          activity["meta-data"] = activity["meta-data"].filter(
            (meta) => !meta.$["android:name"]?.includes("windowLayoutInDisplayCutoutMode")
          );
        }
        // 移除硬編碼的 cutout 模式
        delete activity.$["android:windowLayoutInDisplayCutoutMode"];
      });
    }

    // 添加 Expo 主 Activity 的大屏幕支持和無邊框配置
    if (application.activity) {
      application.activity.forEach((activity) => {
        const activityName = activity.$["android:name"];
        // 為 MainActivity 添加大屏幕支持
        if (activityName?.includes("MainActivity")) {
          activity.$["android:resizeableActivity"] = "true";
          // Android 15+ 無邊框：移除已淘汰的屬性，改用新 API
          // 系統會自動應用 edge-to-edge 繪製
          delete activity.$["android:windowLayoutInDisplayCutoutMode"];
        }
      });
    }

    // 添加 WorkManager 初始化（用於替代 BOOT_COMPLETED）
    if (!application.provider) {
      application.provider = [];
    }

    const workManagerProviderExists = application.provider.some(
      (p) => p.$["android:name"]?.includes("WorkManagerInitializer")
    );

    if (!workManagerProviderExists) {
      application.provider.push({
        $: {
          "android:name": "androidx.work.impl.WorkManagerInitializer",
          "android:authorities": "${applicationId}.workmanager-init",
          "android:exported": "false",
        },
      });
    }

    return config;
  });
};
