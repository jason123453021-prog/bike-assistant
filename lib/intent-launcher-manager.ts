import { Platform, Alert, Linking } from 'react-native';

/**
 * Intent Launcher 管理器
 * 用於在 Android 上啟動系統設定頁面
 * 使用 React Native Linking API 和 Intent URI
 */
export class IntentLauncherManager {
  /**
   * 啟動應用程式詳細資訊頁面
   * 用於管理應用程式權限
   */
  static async openAppSettings(packageName?: string): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] 僅支援 Android 平台');
      return;
    }

    try {
      console.log('[IntentLauncher] 打開應用程式設定...');
      const pkg = packageName || 'space.manus.bike_assistant';
      const uri = `android.settings.APPLICATION_DETAILS_SETTINGS?package=${pkg}`;

      const canOpen = await Linking.canOpenURL(uri);
      if (canOpen) {
        await Linking.openURL(uri);
      } else {
        // 降級方案：打開系統設定
        await Linking.openURL('android.settings.SETTINGS');
      }
    } catch (error) {
      console.error('[IntentLauncher] 打開應用程式設定失敗:', error);
      Alert.alert('錯誤', '無法打開應用程式設定');
    }
  }

  /**
   * 啟動懸浮窗權限設定頁面
   * 針對 Android 12+ 的新權限模型
   */
  static async openOverlayPermissionSettings(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] 僅支援 Android 平台');
      return;
    }

    try {
      console.log('[IntentLauncher] 打開懸浮窗權限設定...');

      // 首先嘗試直接打開懸浮窗權限頁面
      try {
        const uri = `android.settings.action.MANAGE_OVERLAY_PERMISSION?package=space.manus.bike_assistant`;
        const canOpen = await Linking.canOpenURL(uri);

        if (canOpen) {
          await Linking.openURL(uri);
        } else {
          // 降級方案：打開應用程式詳細資訊頁面
          console.warn('[IntentLauncher] 無法直接打開懸浮窗設定，使用降級方案...');
          await this.openAppSettings();
        }
      } catch (error) {
        // 降級方案：打開應用程式詳細資訊頁面
        console.warn('[IntentLauncher] 無法直接打開懸浮窗設定，使用降級方案...');
        await this.openAppSettings();
      }
    } catch (error) {
      console.error('[IntentLauncher] 打開懸浮窗權限設定失敗:', error);
      Alert.alert('錯誤', '無法打開懸浮窗權限設定');
    }
  }

  /**
   * 啟動電池最佳化白名單設定頁面
   */
  static async openBatteryOptimizationSettings(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] 僅支援 Android 平台');
      return;
    }

    try {
      console.log('[IntentLauncher] 打開電池最佳化設定...');

      // 首先嘗試直接打開電池最佳化對話框
      try {
        const uri = `android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS?package=space.manus.bike_assistant`;
        const canOpen = await Linking.canOpenURL(uri);

        if (canOpen) {
          await Linking.openURL(uri);
        } else {
          // 降級方案：打開電池設定頁面
          console.warn('[IntentLauncher] 無法直接打開電池最佳化對話框，使用降級方案...');
          const batteryUri = 'android.settings.BATTERY_SAVER_SETTINGS';
          const canOpenBattery = await Linking.canOpenURL(batteryUri);

          if (canOpenBattery) {
            await Linking.openURL(batteryUri);
          } else {
            // 最終降級：打開應用程式詳細資訊頁面
            console.warn('[IntentLauncher] 使用最終降級方案...');
            await this.openAppSettings();
          }
        }
      } catch (error) {
        // 最終降級：打開應用程式詳細資訊頁面
        console.warn('[IntentLauncher] 使用最終降級方案...');
        await this.openAppSettings();
      }
    } catch (error) {
      console.error('[IntentLauncher] 打開電池最佳化設定失敗:', error);
      Alert.alert('錯誤', '無法打開電池最佳化設定');
    }
  }

  /**
   * 啟動通知權限設定頁面
   */
  static async openNotificationSettings(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] 僅支援 Android 平台');
      return;
    }

    try {
      console.log('[IntentLauncher] 打開通知設定...');
      const uri = `android.settings.APP_NOTIFICATION_SETTINGS?package=space.manus.bike_assistant`;
      const canOpen = await Linking.canOpenURL(uri);

      if (canOpen) {
        await Linking.openURL(uri);
      } else {
        // 降級方案
        await this.openAppSettings();
      }
    } catch (error) {
      console.error('[IntentLauncher] 打開通知設定失敗:', error);
      // 降級方案
      await this.openAppSettings();
    }
  }

  /**
   * 啟動位置權限設定頁面
   */
  static async openLocationSettings(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] 僅支援 Android 平台');
      return;
    }

    try {
      console.log('[IntentLauncher] 打開位置設定...');
      const uri = 'android.settings.LOCATION_SOURCE_SETTINGS';
      const canOpen = await Linking.canOpenURL(uri);

      if (canOpen) {
        await Linking.openURL(uri);
      } else {
        // 降級方案
        await Linking.openURL('android.settings.SETTINGS');
      }
    } catch (error) {
      console.error('[IntentLauncher] 打開位置設定失敗:', error);
      Alert.alert('錯誤', '無法打開位置設定');
    }
  }

  /**
   * 啟動系統設定主頁面
   */
  static async openSystemSettings(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[IntentLauncher] 僅支援 Android 平台');
      return;
    }

    try {
      console.log('[IntentLauncher] 打開系統設定...');
      await Linking.openURL('android.settings.SETTINGS');
    } catch (error) {
      console.error('[IntentLauncher] 打開系統設定失敗:', error);
      Alert.alert('錯誤', '無法打開系統設定');
    }
  }
}

/**
 * 獲取單例實例
 */
export function getIntentLauncherManager(): typeof IntentLauncherManager {
  return IntentLauncherManager;
}
