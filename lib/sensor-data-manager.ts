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
  // 平滑後的數據（移動平均）
  smoothedHeartRate: number | null;
  smoothedCadence: number | null;
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
    smoothedHeartRate: null,
    smoothedCadence: null,
  };
  private unsubscribers: (() => void)[] = [];
  // 平滑缷池（移動平均，最多保留 5 個數據點）
  private heartRateBuffer: number[] = [];
  private cadenceBuffer: number[] = [];
  private readonly BUFFER_SIZE = 5;

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
        // 計算平滑心率（移動平均）
        this.heartRateBuffer.push(data.value);
        if (this.heartRateBuffer.length > this.BUFFER_SIZE) {
          this.heartRateBuffer.shift();
        }
        const avg = this.heartRateBuffer.reduce((a, b) => a + b, 0) / this.heartRateBuffer.length;
        this.sensorData.smoothedHeartRate = Math.round(avg);
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
        // 計算平滑踏頻（移動平均）
        this.cadenceBuffer.push(data.value);
        if (this.cadenceBuffer.length > this.BUFFER_SIZE) {
          this.cadenceBuffer.shift();
        }
        const avg = this.cadenceBuffer.reduce((a, b) => a + b, 0) / this.cadenceBuffer.length;
        this.sensorData.smoothedCadence = Math.round(avg);
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
   * 獲取感測器狀態摘要
   */
  getSensorStatus() {
    const connectedDevices = this.getConnectedDevices();
    const lastUpdateTime = this.sensorData.lastUpdateTime;
    const timeSinceLastUpdate = lastUpdateTime > 0 ? Date.now() - lastUpdateTime : null;
    
    return {
      connectedCount: connectedDevices.length,
      lastUpdateTime,
      timeSinceLastUpdate,
      isConnected: connectedDevices.length > 0,
      lastUpdateTimeStr: lastUpdateTime > 0 ? new Date(lastUpdateTime).toLocaleTimeString() : '--',
      signalQuality: this.calculateSignalQuality(timeSinceLastUpdate),
    };
  }

  /**
   * 計算信號質量（基於最後更新時間）
   */
  private calculateSignalQuality(timeSinceLastUpdate: number | null): 'excellent' | 'good' | 'poor' | 'disconnected' {
    if (timeSinceLastUpdate === null) return 'disconnected';
    if (timeSinceLastUpdate < 2000) return 'excellent';  // < 2 秒
    if (timeSinceLastUpdate < 5000) return 'good';       // < 5 秒
    if (timeSinceLastUpdate < 10000) return 'poor';      // < 10 秒
    return 'disconnected';
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
      smoothedHeartRate: null,
      smoothedCadence: null,
    };
    // 清空平滑缷池
    this.heartRateBuffer = [];
    this.cadenceBuffer = [];
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
