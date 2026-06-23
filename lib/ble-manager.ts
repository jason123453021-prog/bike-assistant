/**
 * BLE 管理器 - 實現 Bluetooth Low Energy (BLE) 連線與數據讀取
 * 
 * 支援標準 GATT 服務：
 * - 心率服務 (0x180D) → 特徵 0x2A37
 * - 功率計服務 (0x1818) → 特徵 0x2A63
 * - 踏頻服務 (0x1816) → 特徵 0x2A5B
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { BleManager } = NativeModules;
const bleManagerEmitter = new NativeEventEmitter(BleManager);

// ─── GATT 服務 UUID ───────────────────────────────────────────────────────
export const GATT_SERVICES = {
  HEART_RATE: "180d",           // 心率服務
  CYCLING_POWER: "1818",        // 功率計服務
  CYCLING_SPEED_CADENCE: "1816", // 踏頻服務
  DEVICE_INFO: "180a",          // 設備資訊服務
} as const;

// ─── GATT 特徵 UUID ───────────────────────────────────────────────────────
export const GATT_CHARACTERISTICS = {
  HEART_RATE_MEASUREMENT: "2a37",      // 心率測量
  CYCLING_POWER_MEASUREMENT: "2a63",   // 功率測量
  CSC_MEASUREMENT: "2a5b",             // 踏頻測量
  DEVICE_NAME: "2a00",                 // 設備名稱
  MANUFACTURER_NAME: "2a29",           // 製造商名稱
  MODEL_NUMBER: "2a24",                // 型號
} as const;

// ─── CCCD UUID (Client Characteristic Configuration Descriptor) ───────────
export const CCCD_UUID = "2902";

// ─── 類型定義 ──────────────────────────────────────────────────────────────

export interface BleDevice {
  id: string;
  name: string;
  rssi: number;
  serviceUuids: string[];
}

export interface ConnectedDevice {
  id: string;
  name: string;
  serviceType: "heartRate" | "power" | "cadence" | "unknown";
  isConnected: boolean;
  lastUpdate: number;
  rssi: number;
}

export interface HeartRateData {
  heartRate: number;
  timestamp: number;
}

export interface PowerData {
  power: number;
  cadence: number;
  timestamp: number;
}

export interface CadenceData {
  cadence: number;
  timestamp: number;
}

// ─── BLE 管理器類別 ────────────────────────────────────────────────────────

export class BleManagerImpl {
  private connectedDevices: Map<string, ConnectedDevice> = new Map();
  private listeners: {
    onHeartRateUpdate?: (data: HeartRateData) => void;
    onPowerUpdate?: (data: PowerData) => void;
    onCadenceUpdate?: (data: CadenceData) => void;
    onDeviceConnected?: (device: ConnectedDevice) => void;
    onDeviceDisconnected?: (deviceId: string) => void;
  } = {};

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 設定事件監聽器
   */
  private setupEventListeners() {
    // 監聽特徵值變化
    bleManagerEmitter.addListener(
      "BleManagerDidUpdateValueForCharacteristic",
      ({ value, characteristic, peripheral }) => {
        this.handleCharacteristicUpdate(characteristic, value, peripheral);
      }
    );

    // 監聽連線狀態
    bleManagerEmitter.addListener("BleManagerDidUpdateState", (rsp) => {
      console.log("[BLE] State updated:", rsp.state);
    });

    // 監聽連線成功
    bleManagerEmitter.addListener("BleManagerDidConnectPeripheral", ({ peripheral }) => {
      console.log("[BLE] Connected:", peripheral);
      this.handleDeviceConnected(peripheral);
    });

    // 監聽斷線
    bleManagerEmitter.addListener("BleManagerDidDisconnectPeripheral", ({ peripheral }) => {
      console.log("[BLE] Disconnected:", peripheral);
      this.handleDeviceDisconnected(peripheral);
    });
  }

  /**
   * 開始掃描 BLE 設備
   */
  async startScanning(serviceUuids?: string[]): Promise<void> {
    try {
      if (Platform.OS === "android") {
        await BleManager.enableBluetooth();
      }

      const options = serviceUuids ? { serviceUUIDs: serviceUuids } : {};
      await BleManager.scan([], 5, true, options);
      console.log("[BLE] Scanning started");
    } catch (error) {
      console.error("[BLE] Scan error:", error);
      throw error;
    }
  }

  /**
   * 停止掃描
   */
  async stopScanning(): Promise<void> {
    try {
      await BleManager.stopScan();
      console.log("[BLE] Scanning stopped");
    } catch (error) {
      console.error("[BLE] Stop scan error:", error);
    }
  }

  /**
   * 連線到設備
   */
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      await BleManager.connect(deviceId);
      console.log("[BLE] Connected to device:", deviceId);

      // 發現服務
      await BleManager.discoverServices(deviceId);
      console.log("[BLE] Services discovered for:", deviceId);

      // 自動訂閱已知的特徵
      await this.subscribeToCharacteristics(deviceId);
    } catch (error) {
      console.error("[BLE] Connection error:", error);
      throw error;
    }
  }

  /**
   * 斷開連線
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      await BleManager.disconnect(deviceId);
      console.log("[BLE] Disconnected from device:", deviceId);
      this.connectedDevices.delete(deviceId);
    } catch (error) {
      console.error("[BLE] Disconnect error:", error);
    }
  }

  /**
   * 訂閱特徵值變化
   */
  private async subscribeToCharacteristics(deviceId: string): Promise<void> {
    const characteristics = [
      { service: GATT_SERVICES.HEART_RATE, characteristic: GATT_CHARACTERISTICS.HEART_RATE_MEASUREMENT },
      { service: GATT_SERVICES.CYCLING_POWER, characteristic: GATT_CHARACTERISTICS.CYCLING_POWER_MEASUREMENT },
      { service: GATT_SERVICES.CYCLING_SPEED_CADENCE, characteristic: GATT_CHARACTERISTICS.CSC_MEASUREMENT },
    ];

    for (const { service, characteristic } of characteristics) {
      try {
        // 啟用通知
        await BleManager.startNotification(deviceId, service, characteristic);
        console.log(`[BLE] Notification enabled for ${service}:${characteristic}`);

        // 設定 CCCD
        await BleManager.write(
          deviceId,
          service,
          CCCD_UUID,
          [0x01, 0x00] // ENABLE_NOTIFICATION_VALUE
        );
      } catch (error) {
        // 特徵可能不存在，忽略
        console.log(`[BLE] Characteristic ${characteristic} not found`);
      }
    }
  }

  /**
   * 處理特徵值更新
   */
  private handleCharacteristicUpdate(characteristic: string, value: number[], peripheral: string) {
    const charLower = characteristic.toLowerCase();

    if (charLower === GATT_CHARACTERISTICS.HEART_RATE_MEASUREMENT) {
      const heartRate = this.parseHeartRateData(value);
      this.listeners.onHeartRateUpdate?.({
        heartRate,
        timestamp: Date.now(),
      });
    } else if (charLower === GATT_CHARACTERISTICS.CYCLING_POWER_MEASUREMENT) {
      const { power, cadence } = this.parsePowerData(value);
      this.listeners.onPowerUpdate?.({
        power,
        cadence,
        timestamp: Date.now(),
      });
    } else if (charLower === GATT_CHARACTERISTICS.CSC_MEASUREMENT) {
      const cadence = this.parseCadenceData(value);
      this.listeners.onCadenceUpdate?.({
        cadence,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 解析心率數據
   * 格式：[flags, heartRate] 或 [flags, heartRate_low, heartRate_high]
   */
  private parseHeartRateData(data: number[]): number {
    if (data.length < 2) return 0;

    const flags = data[0];
    const is16Bit = (flags & 0x01) === 1;

    if (is16Bit && data.length >= 3) {
      // 16-bit 心率值（Little-Endian）
      return (data[2] << 8) | data[1];
    } else {
      // 8-bit 心率值
      return data[1];
    }
  }

  /**
   * 解析功率數據
   * 格式：[flags_low, flags_high, power_low, power_high, ...]
   */
  private parsePowerData(data: number[]): { power: number; cadence: number } {
    if (data.length < 4) return { power: 0, cadence: 0 };

    // 功率值（Little-Endian，位置 2-3）
    const power = (data[3] << 8) | data[2];

    // 踏頻值（如果存在，位置 4-5）
    let cadence = 0;
    if (data.length >= 6) {
      cadence = (data[5] << 8) | data[4];
    }

    return { power, cadence };
  }

  /**
   * 解析踏頻數據
   * 格式：[flags, wheel_revolutions_low, ..., wheel_revolutions_high, wheel_event_time_low, wheel_event_time_high, ...]
   */
  private parseCadenceData(data: number[]): number {
    if (data.length < 5) return 0;

    // 簡化版本：直接返回踏頻值
    // 實際應根據輪轉數與時間戳計算
    const cadence = data[1] || 0;
    return cadence;
  }

  /**
   * 處理設備連線
   */
  private handleDeviceConnected(peripheral: any) {
    const device: ConnectedDevice = {
      id: peripheral.id,
      name: peripheral.name || "Unknown",
      serviceType: this.detectServiceType(peripheral.serviceUuids || []),
      isConnected: true,
      lastUpdate: Date.now(),
      rssi: peripheral.rssi || 0,
    };

    this.connectedDevices.set(peripheral.id, device);
    this.listeners.onDeviceConnected?.(device);
  }

  /**
   * 處理設備斷線
   */
  private handleDeviceDisconnected(peripheral: any) {
    this.connectedDevices.delete(peripheral.id);
    this.listeners.onDeviceDisconnected?.(peripheral.id);
  }

  /**
   * 檢測服務類型
   */
  private detectServiceType(serviceUuids: string[]): ConnectedDevice["serviceType"] {
    const uuidsLower = serviceUuids.map((u) => u.toLowerCase());

    if (uuidsLower.includes(GATT_SERVICES.HEART_RATE)) return "heartRate";
    if (uuidsLower.includes(GATT_SERVICES.CYCLING_POWER)) return "power";
    if (uuidsLower.includes(GATT_SERVICES.CYCLING_SPEED_CADENCE)) return "cadence";
    return "unknown";
  }

  /**
   * 獲取已連接設備列表
   */
  getConnectedDevices(): ConnectedDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * 設定事件監聽器
   */
  on(event: keyof typeof this.listeners, callback: any) {
    this.listeners[event] = callback;
  }

  /**
   * 移除事件監聽器
   */
  off(event: keyof typeof this.listeners) {
    this.listeners[event] = undefined;
  }

  /**
   * 清理資源
   */
  destroy() {
    bleManagerEmitter.removeAllListeners("BleManagerDidUpdateValueForCharacteristic");
    bleManagerEmitter.removeAllListeners("BleManagerDidUpdateState");
    bleManagerEmitter.removeAllListeners("BleManagerDidConnectPeripheral");
    bleManagerEmitter.removeAllListeners("BleManagerDidDisconnectPeripheral");
    this.connectedDevices.clear();
  }
}

// 導出單例
export const bleManager = new BleManagerImpl();
