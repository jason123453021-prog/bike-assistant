/**
 * 藍牙感測器管理
 * 支援心率帶、功率計、踏頻器的藍牙連接和數據接收
 */

export type SensorType = 'heart-rate' | 'power-meter' | 'cadence-sensor';

export interface SensorDevice {
  id: string;
  name: string;
  type: SensorType;
  isConnected: boolean;
  lastDataTime: number;
  batteryLevel?: number;
}

export interface SensorData {
  type: SensorType;
  timestamp: number;
  value: number;
  unit: string;
}

export class BluetoothSensorManager {
  private devices: Map<string, SensorDevice> = new Map();
  private dataListeners: Map<SensorType, (data: SensorData) => void> = new Map();
  private connectionListeners: Map<string, (connected: boolean) => void> = new Map();

  /**
   * 掃描附近的藍牙感測器
   */
  async scanDevices(): Promise<SensorDevice[]> {
    // TODO: 實現實際的藍牙掃描邏輯
    // 使用 expo-ble 或原生 BLE API
    const mockDevices: SensorDevice[] = [
      {
        id: 'hr-001',
        name: 'Polar H10',
        type: 'heart-rate',
        isConnected: false,
        lastDataTime: 0,
        batteryLevel: 85,
      },
      {
        id: 'power-001',
        name: 'Garmin Vector 3',
        type: 'power-meter',
        isConnected: false,
        lastDataTime: 0,
        batteryLevel: 92,
      },
      {
        id: 'cadence-001',
        name: 'Wahoo RPM',
        type: 'cadence-sensor',
        isConnected: false,
        lastDataTime: 0,
        batteryLevel: 78,
      },
    ];

    mockDevices.forEach((device) => {
      this.devices.set(device.id, device);
    });

    return mockDevices;
  }

  /**
   * 連接感測器
   */
  async connectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    try {
      // TODO: 實現實際的藍牙連接邏輯
      device.isConnected = true;
      device.lastDataTime = Date.now();

      // 通知連接狀態變化
      this.connectionListeners.get(deviceId)?.(true);

      // 模擬數據接收
      this.simulateDataReceiving(device);

      return true;
    } catch (error) {
      console.error(`Failed to connect device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * 斷開感測器連接
   */
  async disconnectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    try {
      // TODO: 實現實際的藍牙斷開邏輯
      device.isConnected = false;

      // 通知連接狀態變化
      this.connectionListeners.get(deviceId)?.(false);

      return true;
    } catch (error) {
      console.error(`Failed to disconnect device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * 註冊數據監聽器
   */
  onSensorData(type: SensorType, callback: (data: SensorData) => void): () => void {
    this.dataListeners.set(type, callback);

    // 返回取消監聽函式
    return () => {
      this.dataListeners.delete(type);
    };
  }

  /**
   * 註冊連接狀態監聽器
   */
  onConnectionChange(deviceId: string, callback: (connected: boolean) => void): () => void {
    this.connectionListeners.set(deviceId, callback);

    // 返回取消監聽函式
    return () => {
      this.connectionListeners.delete(deviceId);
    };
  }

  /**
   * 獲取所有設備
   */
  getDevices(): SensorDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * 獲取特定設備
   */
  getDevice(deviceId: string): SensorDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * 獲取連接的設備
   */
  getConnectedDevices(): SensorDevice[] {
    return Array.from(this.devices.values()).filter((d) => d.isConnected);
  }

  /**
   * 模擬數據接收（用於測試）
   */
  private simulateDataReceiving(device: SensorDevice): void {
    const interval = setInterval(() => {
      if (!device.isConnected) {
        clearInterval(interval);
        return;
      }

      let data: SensorData | null = null;

      switch (device.type) {
        case 'heart-rate':
          // 模擬心率數據（60-180 bpm）
          data = {
            type: 'heart-rate',
            timestamp: Date.now(),
            value: Math.floor(Math.random() * 120 + 60),
            unit: 'bpm',
          };
          break;

        case 'power-meter':
          // 模擬功率數據（0-500 W）
          data = {
            type: 'power-meter',
            timestamp: Date.now(),
            value: Math.floor(Math.random() * 500),
            unit: 'W',
          };
          break;

        case 'cadence-sensor':
          // 模擬踏頻數據（0-200 rpm）
          data = {
            type: 'cadence-sensor',
            timestamp: Date.now(),
            value: Math.floor(Math.random() * 200),
            unit: 'rpm',
          };
          break;
      }

      if (data) {
        device.lastDataTime = data.timestamp;
        this.dataListeners.get(device.type)?.(data);
      }
    }, 1000); // 每秒更新一次
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.devices.forEach((device) => {
      if (device.isConnected) {
        this.disconnectDevice(device.id);
      }
    });

    this.devices.clear();
    this.dataListeners.clear();
    this.connectionListeners.clear();
  }
}

// 全局實例
export const bluetoothSensorManager = new BluetoothSensorManager();
