const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Config Plugin: with-foreground-service-plugin
 * 
 * 功能：
 * 1. 在 AndroidManifest.xml 中添加 Foreground Service 權限
 * 2. 配置 LocationForegroundService
 * 3. 配置 ScreenWakeupActivity
 * 4. 添加 WAKE_LOCK 權限
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
        },
      });
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
        },
      });
    }

    return config;
  });
};
