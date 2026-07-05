import { NativeModules, Platform } from 'react-native';

const { MMKVModule } = NativeModules;

/**
 * MMKV Bridge for React Native
 * High-performance key-value storage for frequent GPS data writes
 * MMKV is 100x faster than AsyncStorage
 */
export class MMKVBridge {
  /**
   * Set a string value
   */
  static async setString(key: string, value: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      return await MMKVModule.setString(key, value);
    } catch (error) {
      console.error('MMKVBridge: Failed to set string -', error);
      return false;
    }
  }

  /**
   * Get a string value
   */
  static async getString(key: string): Promise<string | null> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return null;
    }

    try {
      return await MMKVModule.getString(key);
    } catch (error) {
      console.error('MMKVBridge: Failed to get string -', error);
      return null;
    }
  }

  /**
   * Set a number value
   */
  static async setNumber(key: string, value: number): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      return await MMKVModule.setNumber(key, value);
    } catch (error) {
      console.error('MMKVBridge: Failed to set number -', error);
      return false;
    }
  }

  /**
   * Get a number value
   */
  static async getNumber(key: string): Promise<number | null> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return null;
    }

    try {
      return await MMKVModule.getNumber(key);
    } catch (error) {
      console.error('MMKVBridge: Failed to get number -', error);
      return null;
    }
  }

  /**
   * Set a JSON object
   */
  static async setObject(key: string, value: Record<string, any>): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      const jsonString = JSON.stringify(value);
      return await MMKVModule.setObject(key, jsonString);
    } catch (error) {
      console.error('MMKVBridge: Failed to set object -', error);
      return false;
    }
  }

  /**
   * Get a JSON object
   */
  static async getObject(key: string): Promise<Record<string, any> | null> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return null;
    }

    try {
      const jsonString = await MMKVModule.getObject(key);
      if (jsonString) {
        return JSON.parse(jsonString);
      }
      return null;
    } catch (error) {
      console.error('MMKVBridge: Failed to get object -', error);
      return null;
    }
  }

  /**
   * Set a JSON array
   */
  static async setArray(key: string, value: any[]): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      const jsonString = JSON.stringify(value);
      return await MMKVModule.setArray(key, jsonString);
    } catch (error) {
      console.error('MMKVBridge: Failed to set array -', error);
      return false;
    }
  }

  /**
   * Get a JSON array
   */
  static async getArray(key: string): Promise<any[] | null> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return null;
    }

    try {
      const jsonString = await MMKVModule.getArray(key);
      if (jsonString) {
        return JSON.parse(jsonString);
      }
      return null;
    } catch (error) {
      console.error('MMKVBridge: Failed to get array -', error);
      return null;
    }
  }

  /**
   * Remove a key
   */
  static async removeKey(key: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      return await MMKVModule.removeKey(key);
    } catch (error) {
      console.error('MMKVBridge: Failed to remove key -', error);
      return false;
    }
  }

  /**
   * Clear all data
   */
  static async clearAll(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      return await MMKVModule.clearAll();
    } catch (error) {
      console.error('MMKVBridge: Failed to clear all -', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  static async hasKey(key: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      return await MMKVModule.hasKey(key);
    } catch (error) {
      console.error('MMKVBridge: Failed to check key -', error);
      return false;
    }
  }

  /**
   * Append GPS data point (optimized for high-frequency writes)
   * Each write is extremely fast (< 1ms)
   */
  static async appendGPSData(
    key: string,
    latitude: number,
    longitude: number,
    speed: number,
    timestamp: number
  ): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return false;
    }

    try {
      return await MMKVModule.appendGPSData(key, latitude, longitude, speed, timestamp);
    } catch (error) {
      console.error('MMKVBridge: Failed to append GPS data -', error);
      return false;
    }
  }

  /**
   * Get GPS data array
   */
  static async getGPSData(key: string): Promise<any[] | null> {
    if (Platform.OS !== 'android') {
      console.warn('MMKVBridge: MMKV is only available on Android');
      return null;
    }

    try {
      const jsonString = await MMKVModule.getGPSData(key);
      if (jsonString) {
        return JSON.parse(jsonString);
      }
      return null;
    } catch (error) {
      console.error('MMKVBridge: Failed to get GPS data -', error);
      return null;
    }
  }
}
