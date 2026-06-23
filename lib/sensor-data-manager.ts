/**
 * 感測器數據管理器
 * 整合藍牙感測器數據到騎乘狀態
 */

import { BluetoothSensorManager, SensorData, SensorType } from './bluetooth-sensor';
import { bleIntegration, type BleIntegration } from './ble-integration';
import { type HeartRateData, type PowerData, type CadenceData } from './ble-manager';

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
  private bleIntegration: BleIntegration = bleIntegration;
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
    // 初始化 BLE 整合層
    try {
      this.setupBleListeners();
      console.log('[SensorDataManager] BLE integration initialized');
    } catch (error) {
      console.error('[SensorDataManager] BLE initialization failed:', error);
    }

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
   * 設定 BLE 事件監聽器
   */
  private setupBleListeners(): void {
    // 監聽心率更新
    this.bleIntegration.on('onHeartRateUpdate', (data: HeartRateData) => {
      this.sensorData.heartRate = data.heartRate;
      if (!this.sensorData.maxHeartRate || data.heartRate > this.sensorData.maxHeartRate) {
        this.sensorData.maxHeartRate = data.heartRate;
      }
      // 計算平滑心率
      this.heartRateBuffer.push(data.heartRate);
      if (this.heartRateBuffer.length > this.BUFFER_SIZE) {
        this.heartRateBuffer.shift();
      }
      const avg = this.heartRateBuffer.reduce((a, b) => a + b, 0) / this.heartRateBuffer.length;
      this.sensorData.smoothedHeartRate = Math.round(avg);
      this.sensorData.lastUpdateTime = Date.now();
    });

    // 監聽功率更新
    this.bleIntegration.on('onPowerUpdate', (data: PowerData) => {
      this.sensorData.power = data.power;
      if (!this.sensorData.maxPower || data.power > this.sensorData.maxPower) {
        this.sensorData.maxPower = data.power;
      }
      // 踏頻也可能從功率計獲得
      if (data.cadence > 0) {
        this.sensorData.cadence = data.cadence;
        if (!this.sensorData.maxCadence || data.cadence > this.sensorData.maxCadence) {
          this.sensorData.maxCadence = data.cadence;
        }
      }
      this.sensorData.lastUpdateTime = Date.now();
    });

    // 監聽踏頻更新
    this.bleIntegration.on('onCadenceUpdate', (data: CadenceData) => {
      this.sensorData.cadence = data.cadence;
      if (!this.sensorData.maxCadence || data.cadence > this.sensorData.maxCadence) {
        this.sensorData.maxCadence = data.cadence;
      }
      // 計算平滑踏頻
      this.cadenceBuffer.push(data.cadence);
      if (this.cadenceBuffer.length > this.BUFFER_SIZE) {
        this.cadenceBuffer.shift();
      }
      const avg = this.cadenceBuffer.reduce((a, b) => a + b, 0) / this.cadenceBuffer.length;
      this.sensorData.smoothedCadence = Math.round(avg);
      this.sensorData.lastUpdateTime = Date.now();
    });
  }

  /**
   * 連接感測器（舊 API，保留向後相容）
   */
  async connectSensor(deviceId: string): Promise<boolean> {
    try {
      await this.connectBleDevice(deviceId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 斷開感測器（舊 API，保留向後相容）
   */
  async disconnectSensor(deviceId: string): Promise<boolean> {
    try {
      await this.disconnectBleDevice(deviceId);
      return true;
    } catch (error) {
      return false;
    }
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
   * 開始掃描 BLE 設備
   */
  async startBleScanning(): Promise<void> {
    try {
      await this.bleIntegration.startScanning();
    } catch (error) {
      console.error('[SensorDataManager] BLE scanning failed:', error);
    }
  }

  /**
   * 停止掃描 BLE 設備
   */
  async stopBleScanning(): Promise<void> {
    try {
      await this.bleIntegration.stopScanning();
    } catch (error) {
      console.error('[SensorDataManager] BLE stop scanning failed:', error);
    }
  }

  /**
   * 連接 BLE 設備
   */
  async connectBleDevice(deviceId: string): Promise<void> {
    try {
      await this.bleIntegration.connectToDevice(deviceId);
    } catch (error) {
      console.error('[SensorDataManager] BLE connection failed:', error);
    }
  }

  /**
   * 斷開 BLE 設備
   */
  async disconnectBleDevice(deviceId: string): Promise<void> {
    try {
      await this.bleIntegration.disconnectDevice(deviceId);
    } catch (error) {
      console.error('[SensorDataManager] BLE disconnection failed:', error);
    }
  }

  /**
   * 獲取 BLE 連接設備列表
   */
  getBleConnectedDevices() {
    return this.bleIntegration.getConnectedDevices();
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.bluetoothManager.dispose();
    this.bleIntegration.destroy();
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
