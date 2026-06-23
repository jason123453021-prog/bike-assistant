/**
 * 感測器數據管理器
 * 整合藍牙感測器數據到騎乘狀態
 */

import { BluetoothSensorManager, SensorData, SensorType } from './bluetooth-sensor';

export interface RealTimeSensorData {
  heartRate: number | null;
  maxHeartRate: number | null;
  power: number | null;
  maxPower: number | null;
  cadence: number | null;
  maxCadence: number | null;
  lastUpdateTime: number;
}

export class SensorDataManager {
  private bluetoothManager: BluetoothSensorManager;
  private sensorData: RealTimeSensorData = {
    heartRate: null,
    maxHeartRate: null,
    power: null,
    maxPower: null,
    cadence: null,
    maxCadence: null,
    lastUpdateTime: 0,
  };
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.bluetoothManager = new BluetoothSensorManager();
  }

  /**
   * 初始化感測器數據監聽
   */
  async initialize(): Promise<void> {
    // 掃描設備
    await this.bluetoothManager.scanDevices();

    // 註冊心率數據監聽
    const unsubHeartRate = this.bluetoothManager.onSensorData(
      'heart-rate',
      (data: SensorData) => {
        this.sensorData.heartRate = data.value;
        if (!this.sensorData.maxHeartRate || data.value > this.sensorData.maxHeartRate) {
          this.sensorData.maxHeartRate = data.value;
        }
        this.sensorData.lastUpdateTime = Date.now();
      }
    );

    // 註冊功率數據監聽
    const unsubPower = this.bluetoothManager.onSensorData(
      'power-meter',
      (data: SensorData) => {
        this.sensorData.power = data.value;
        if (!this.sensorData.maxPower || data.value > this.sensorData.maxPower) {
          this.sensorData.maxPower = data.value;
        }
        this.sensorData.lastUpdateTime = Date.now();
      }
    );

    // 註冊踏頻數據監聽
    const unsubCadence = this.bluetoothManager.onSensorData(
      'cadence-sensor',
      (data: SensorData) => {
        this.sensorData.cadence = data.value;
        if (!this.sensorData.maxCadence || data.value > this.sensorData.maxCadence) {
          this.sensorData.maxCadence = data.value;
        }
        this.sensorData.lastUpdateTime = Date.now();
      }
    );

    this.unsubscribers.push(unsubHeartRate, unsubPower, unsubCadence);
  }

  /**
   * 連接感測器
   */
  async connectSensor(deviceId: string): Promise<boolean> {
    return await this.bluetoothManager.connectDevice(deviceId);
  }

  /**
   * 斷開感測器
   */
  async disconnectSensor(deviceId: string): Promise<boolean> {
    return await this.bluetoothManager.disconnectDevice(deviceId);
  }

  /**
   * 獲取實時感測器數據
   */
  getSensorData(): RealTimeSensorData {
    return { ...this.sensorData };
  }

  /**
   * 獲取連接的設備列表
   */
  getConnectedDevices() {
    return this.bluetoothManager.getConnectedDevices();
  }

  /**
   * 獲取所有設備
   */
  getAllDevices() {
    return this.bluetoothManager.getDevices();
  }

  /**
   * 重置數據（騎乘結束時調用）
   */
  resetData(): void {
    this.sensorData = {
      heartRate: null,
      maxHeartRate: null,
      power: null,
      maxPower: null,
      cadence: null,
      maxCadence: null,
      lastUpdateTime: 0,
    };
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.bluetoothManager.dispose();
  }
}

// 全局單例
let sensorDataManager: SensorDataManager | null = null;

export function getSensorDataManager(): SensorDataManager {
  if (!sensorDataManager) {
    sensorDataManager = new SensorDataManager();
  }
  return sensorDataManager;
}
