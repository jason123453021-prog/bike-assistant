import { Linking, Platform } from 'react-native';

/**
 * 改進的 Intent Launcher 管理器
 * 使用 React Native Linking API 實現精準跳轉至 Android 系統設定頁面
 * 支援降級防護處理客製化 Android 系統
 */
export class IntentLauncherImproved {
  /**
   * 跳轉至懸浮窗權限設定頁面
   */
  static async openOverlayPermissionSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] Overlay permission only available on Android');
      return false;
    }

    try {
      const packageName = 'com.jason123453021.bikeassistant';
      // 使用 ACTION_MANAGE_OVERLAY_PERMISSION 跳轉至懸浮窗權限設定
      const url = `android-app://android.settings/action/MANAGE_OVERLAY_PERMISSION?package=${packageName}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }
      
      // 降級方案：跳轉至應用詳情頁面
      console.warn('[IntentLauncher] Overlay permission URL not supported, falling back to app details');
      return await this.openAppDetails();
    } catch (error) {
      console.error('[IntentLauncher] Error opening overlay permission settings:', error);
      return false;
    }
  }

  /**
   * 跳轉至電池最佳化白名單設定
   * 優先使用直接彈窗，失敗時降級至總列表
   */
  static async openBatteryOptimizationSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] Battery optimization only available on Android');
      return false;
    }

    try {
      const packageName = 'com.jason123453021.bikeassistant';
      
      // 嘗試方案 1：直接彈出允許白名單的對話框
      const requestUrl = `android-app://android.settings/action/REQUEST_IGNORE_BATTERY_OPTIMIZATIONS?package=${packageName}`;
      
      try {
        const canOpenRequest = await Linking.canOpenURL(requestUrl);
        if (canOpenRequest) {
          await Linking.openURL(requestUrl);
          return true;
        }
      } catch (e) {
        console.warn('[IntentLauncher] REQUEST_IGNORE_BATTERY_OPTIMIZATIONS not supported');
      }

      // 降級方案 2：跳轉至電池最佳化總列表
      console.warn('[IntentLauncher] Falling back to battery optimization list');
      const settingsUrl = 'android-app://android.settings/action/IGNORE_BATTERY_OPTIMIZATION_SETTINGS';
      
      const canOpenSettings = await Linking.canOpenURL(settingsUrl);
      if (canOpenSettings) {
        await Linking.openURL(settingsUrl);
        return true;
      }

      // 最終降級方案 3：跳轉至應用詳情頁面
      console.warn('[IntentLauncher] Falling back to app details');
      return await this.openAppDetails();
    } catch (error) {
      console.error('[IntentLauncher] Error opening battery optimization settings:', error);
      return false;
    }
  }

  /**
   * 跳轉至應用詳情頁面
   */
  static async openAppDetails(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] App details only available on Android');
      return false;
    }

    try {
      const packageName = 'com.jason123453021.bikeassistant';
      const url = `android-app://android.settings/action/APPLICATION_DETAILS_SETTINGS?package=${packageName}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }

      // 備用方案：使用標準 URI scheme
      const fallbackUrl = `package:${packageName}`;
      await Linking.openURL(fallbackUrl);
      return true;
    } catch (error) {
      console.error('[IntentLauncher] Error opening app details:', error);
      return false;
    }
  }

  /**
   * 跳轉至位置權限設定
   */
  static async openLocationPermissionSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] Location permission only available on Android');
      return false;
    }

    try {
      // 跳轉至應用詳情頁面，用戶可在此修改位置權限
      return await this.openAppDetails();
    } catch (error) {
      console.error('[IntentLauncher] Error opening location permission settings:', error);
      return false;
    }
  }

  /**
   * 跳轉至通知權限設定
   */
  static async openNotificationPermissionSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] Notification permission only available on Android');
      return false;
    }

    try {
      // 跳轉至應用詳情頁面，用戶可在此修改通知權限
      return await this.openAppDetails();
    } catch (error) {
      console.error('[IntentLauncher] Error opening notification permission settings:', error);
      return false;
    }
  }
}
