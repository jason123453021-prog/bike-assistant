/**
 * BLE 整合層 - 連接 BleManager 與 SensorDataManager
 * 
 * 負責：
 * 1. 初始化 BLE 掃描與連線
 * 2. 將 BLE 數據轉換為 SensorDataManager 格式
 * 3. 管理連線狀態與自動重連
 */

import { bleManager, GATT_SERVICES, type BleDevice, type ConnectedDevice, type HeartRateData, type PowerData, type CadenceData } from "./ble-manager";

export interface BleIntegrationConfig {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  scanTimeout?: number;
}

export class BleIntegration {
  private config: Required<BleIntegrationConfig>;
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastSeenDevices: Map<string, number> = new Map();

  constructor(config: BleIntegrationConfig = {}) {
    this.config = {
      autoConnect: config.autoConnect ?? true,
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 5000,
      scanTimeout: config.scanTimeout ?? 10000,
    };

    this.setupBleListeners();
  }

  /**
   * 設定 BLE 事件監聽器
   */
  private setupBleListeners() {
    bleManager.on("onHeartRateUpdate", (data: HeartRateData) => {
      console.log("[BLE Integration] Heart rate:", data.heartRate);
    });

    bleManager.on("onPowerUpdate", (data: PowerData) => {
      console.log("[BLE Integration] Power:", data.power, "Cadence:", data.cadence);
    });

    bleManager.on("onCadenceUpdate", (data: CadenceData) => {
      console.log("[BLE Integration] Cadence:", data.cadence);
    });

    bleManager.on("onDeviceConnected", (device: ConnectedDevice) => {
      console.log("[BLE Integration] Device connected:", device.name);
      this.clearReconnectTimer(device.id);
    });

    bleManager.on("onDeviceDisconnected", (deviceId: string) => {
      console.log("[BLE Integration] Device disconnected:", deviceId);
      if (this.config.autoReconnect) {
        this.scheduleReconnect(deviceId);
      }
    });
  }

  /**
   * 開始掃描 BLE 設備
   */
  async startScanning(): Promise<void> {
    try {
      const serviceUuids = Object.values(GATT_SERVICES);
      await bleManager.startScanning(serviceUuids);

      // 設定掃描超時
      setTimeout(() => {
        bleManager.stopScanning();
      }, this.config.scanTimeout);
    } catch (error) {
      console.error("[BLE Integration] Scan error:", error);
    }
  }

  /**
   * 停止掃描
   */
  async stopScanning(): Promise<void> {
    await bleManager.stopScanning();
  }

  /**
   * 連線到設備
   */
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      await bleManager.connectToDevice(deviceId);
      this.lastSeenDevices.set(deviceId, Date.now());
    } catch (error) {
      console.error("[BLE Integration] Connection failed:", error);
      if (this.config.autoReconnect) {
        this.scheduleReconnect(deviceId);
      }
    }
  }

  /**
   * 斷開連線
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    this.clearReconnectTimer(deviceId);
    await bleManager.disconnectDevice(deviceId);
  }

  /**
   * 排程重連
   */
  private scheduleReconnect(deviceId: string) {
    // 清除舊的計時器
    this.clearReconnectTimer(deviceId);

    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      console.log("[BLE Integration] Attempting to reconnect:", deviceId);
      this.connectToDevice(deviceId).catch((error) => {
        console.error("[BLE Integration] Reconnect failed:", error);
      });
    }, this.config.reconnectInterval);

    this.reconnectTimers.set(deviceId, timer);
  }

  /**
   * 清除重連計時器
   */
  private clearReconnectTimer(deviceId: string) {
    const timer = this.reconnectTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(deviceId);
    }
  }

  /**
   * 獲取已連接設備
   */
  getConnectedDevices(): ConnectedDevice[] {
    return bleManager.getConnectedDevices();
  }

  /**
   * 獲取設備連線狀態
   */
  getDeviceStatus(deviceId: string): ConnectedDevice | undefined {
    return bleManager.getConnectedDevices().find((d) => d.id === deviceId);
  }

  /**
   * 設定事件監聽器
   */
  on(event: string, callback: any) {
    bleManager.on(event as any, callback);
  }

  /**
   * 移除事件監聽器
   */
  off(event: string) {
    bleManager.off(event as any);
  }

  /**
   * 清理資源
   */
  destroy() {
    // 清除所有重連計時器
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    // 清理 BLE 管理器
    bleManager.destroy();
    console.log('[BleIntegration] Destroyed');
  }
}

// 導出單例
export const bleIntegration = new BleIntegration({
  autoConnect: true,
  autoReconnect: true,
  reconnectInterval: 5000,
});
