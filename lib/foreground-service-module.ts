import { NativeModules, Platform } from 'react-native';

const { ForegroundServiceModule } = NativeModules;

/**
 * Foreground Service Module for React Native
 * Provides interface to start/stop native Foreground Service
 * Only available on Android
 */
export class ForegroundServiceBridge {
  /**
   * Start Foreground Service for continuous GPS tracking
   * This ensures the app process stays alive even when in background or screen is locked
   */
  static async startService(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('ForegroundServiceBridge: Foreground Service is only available on Android');
      return;
    }

    try {
      if (!ForegroundServiceModule) {
        console.error('ForegroundServiceBridge: ForegroundServiceModule not available');
        return;
      }

      const result = await ForegroundServiceModule.startService();
      console.log('ForegroundServiceBridge: Service started -', result);
    } catch (error) {
      console.error('ForegroundServiceBridge: Failed to start service -', error);
    }
  }

  /**
   * Stop Foreground Service
   */
  static async stopService(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('ForegroundServiceBridge: Foreground Service is only available on Android');
      return;
    }

    try {
      if (!ForegroundServiceModule) {
        console.error('ForegroundServiceBridge: ForegroundServiceModule not available');
        return;
      }

      const result = await ForegroundServiceModule.stopService();
      console.log('ForegroundServiceBridge: Service stopped -', result);
    } catch (error) {
      console.error('ForegroundServiceBridge: Failed to stop service -', error);
    }
  }
}
