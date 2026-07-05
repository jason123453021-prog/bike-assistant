import { ConfigPlugin, withAndroidManifest } from 'expo/config-plugins';

const withForegroundService: ConfigPlugin = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults as any;
    
    // 確保 manifest 對象存在
    if (!androidManifest.manifest) {
      androidManifest.manifest = {};
    }

    // 添加必要的權限
    const permissions = [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.WAKE_LOCK',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    ];

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    for (const permission of permissions) {
      const exists = (androidManifest.manifest['uses-permission'] as any[]).some(
        (p) => p.$['android:name'] === permission
      );
      if (!exists) {
        (androidManifest.manifest['uses-permission'] as any[]).push({
          $: { 'android:name': permission },
        });
      }
    }

    // 添加 Foreground Service 到 application 中
    if (!androidManifest.manifest.application) {
      androidManifest.manifest.application = [];
    }

    const application = androidManifest.manifest.application[0];
    if (!application.service) {
      application.service = [];
    }

    // 檢查 Foreground Service 是否已存在
    const serviceExists = (application.service as any[]).some(
      (s) => s.$['android:name'] === 'com.bikeassistant.BikeAssistantForegroundService'
    );

    if (!serviceExists) {
      (application.service as any[]).push({
        $: {
          'android:name': 'com.bikeassistant.BikeAssistantForegroundService',
          'android:foregroundServiceType': 'location',
          'android:enabled': 'true',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
};

export default withForegroundService;
