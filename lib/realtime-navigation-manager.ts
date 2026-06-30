import * as Location from 'expo-location';
import { getTurnVoiceNotificationManager } from './turn-voice-notification-manager';
import { TurnByTurnNavigationManager } from './turn-by-turn-navigation';
import { GpxOptimizer, type GpxPoint } from './gpx-optimizer';

export interface NavigationRoute {
  id: string;
  polyline: [number, number][];
  instructions: any[];
  totalDistance: number;
  totalDuration: number;
}

export interface NavigationState {
  isNavigating: boolean;
  currentLocation: [number, number] | null;
  currentStepIndex: number;
  totalSteps: number;
  distanceToNextTurn: number;
  distanceFromStart: number;
  totalDistanceTraveled: number;
  isOffRoute: boolean;
  offRouteDistance: number;
  eta: number; // 預計到達時間（秒）
  currentSpeed: number; // m/s
  averageSpeed: number; // m/s
  elapsedTime: number; // 秒
}

export interface NavigationEvent {
  type: 'approaching-turn' | 'immediate-turn' | 'off-route' | 'back-on-route' | 'step-completed' | 'navigation-complete';
  timestamp: number;
  data: any;
}

const LOCATION_UPDATE_INTERVAL = 5000; // 5 秒更新一次位置
const OFF_ROUTE_THRESHOLD = 50; // 50 米視為偏離路線

/**
 * 實時導航管理器
 * 功能：
 * - 實時 GPS 位置追蹤
 * - 與語音提示系統集成
 * - 自動轉向指令觸發
 * - 偏離路線檢測
 * - 導航進度追蹤
 */
export class RealtimeNavigationManager {
  private route: NavigationRoute | null = null;
  private state: NavigationState = {
    isNavigating: false,
    currentLocation: null,
    currentStepIndex: 0,
    totalSteps: 0,
    distanceToNextTurn: 0,
    distanceFromStart: 0,
    totalDistanceTraveled: 0,
    isOffRoute: false,
    offRouteDistance: 0,
    eta: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    elapsedTime: 0,
  };

  private locationSubscription: Location.LocationSubscription | null = null;
  private navigationStartTime: number | null = null;
  private trackPoints: GpxPoint[] = [];
  private listeners: Set<(event: NavigationEvent) => void> = new Set();
  private voiceManager = getTurnVoiceNotificationManager();
  private turnNavigator = new TurnByTurnNavigationManager();
  private lastNotifiedStepIndex = -1;
  private previousLocation: [number, number] | null = null;

  /**
   * 初始化實時導航
   */
  async initialize(): Promise<void> {
    try {
      // 請求位置權限
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      console.log('[RealtimeNavigationManager] Initialized');
    } catch (error) {
      console.error('[RealtimeNavigationManager] Initialization error:', error);
      throw error;
    }
  }

  /**
   * 開始導航
   */
  async startNavigation(route: NavigationRoute): Promise<void> {
    try {
      this.route = route;
      this.state = {
        isNavigating: true,
        currentLocation: null,
        currentStepIndex: 0,
        totalSteps: route.instructions.length,
        distanceToNextTurn: 0,
        distanceFromStart: 0,
        totalDistanceTraveled: 0,
        isOffRoute: false,
        offRouteDistance: 0,
        eta: route.totalDuration,
        currentSpeed: 0,
        averageSpeed: 0,
        elapsedTime: 0,
      };

      this.navigationStartTime = Date.now();
      this.trackPoints = [];
      this.lastNotifiedStepIndex = -1;
      this.previousLocation = null;

      // 設置轉向導航
      this.turnNavigator.setInstructions(route.instructions, route.polyline);

      // 開始位置追蹤
      await this.startLocationTracking();

      console.log('[RealtimeNavigationManager] Navigation started');
      this.notifyListeners({
        type: 'navigation-complete',
        timestamp: Date.now(),
        data: { message: 'Navigation started' },
      });
    } catch (error) {
      console.error('[RealtimeNavigationManager] Error starting navigation:', error);
      throw error;
    }
  }

  /**
   * 停止導航
   */
  async stopNavigation(): Promise<void> {
    try {
      this.state.isNavigating = false;
      await this.stopLocationTracking();

      console.log('[RealtimeNavigationManager] Navigation stopped');
      this.notifyListeners({
        type: 'navigation-complete',
        timestamp: Date.now(),
        data: { message: 'Navigation stopped' },
      });
    } catch (error) {
      console.error('[RealtimeNavigationManager] Error stopping navigation:', error);
    }
  }

  /**
   * 開始位置追蹤
   */
  private async startLocationTracking(): Promise<void> {
    try {
      // 停止現有的訂閱
      if (this.locationSubscription) {
        this.locationSubscription.remove();
      }

      // 訂閱位置更新
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 10, // 移動 10 米時更新
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      console.log('[RealtimeNavigationManager] Location tracking started');
    } catch (error) {
      console.error('[RealtimeNavigationManager] Error starting location tracking:', error);
    }
  }

  /**
   * 停止位置追蹤
   */
  private async stopLocationTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      console.log('[RealtimeNavigationManager] Location tracking stopped');
    } catch (error) {
      console.error('[RealtimeNavigationManager] Error stopping location tracking:', error);
    }
  }

  /**
   * 處理位置更新
   */
  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    try {
      if (!this.route || !this.state.isNavigating) {
        return;
      }

      const currentLocation: [number, number] = [location.coords.latitude, location.coords.longitude];
      const currentSpeed = location.coords.speed || 0;

      // 更新狀態
      this.state.currentLocation = currentLocation;
      this.state.currentSpeed = currentSpeed;

      // 計算速度
      if (this.previousLocation) {
        const distance = this.haversineDistance(this.previousLocation, currentLocation);
        this.state.totalDistanceTraveled += distance;
      }

      // 計算經過時間
      if (this.navigationStartTime) {
        this.state.elapsedTime = (Date.now() - this.navigationStartTime) / 1000;
        this.state.averageSpeed = this.state.totalDistanceTraveled / this.state.elapsedTime;
      }

      // 記錄軌跡點
      this.trackPoints.push({
        latitude: currentLocation[0],
        longitude: currentLocation[1],
        timestamp: Date.now(),
        speed: currentSpeed,
      });

      // 獲取轉向導航狀態
      const turnState = this.turnNavigator.getCurrentState(currentLocation);

      // 更新導航狀態
      this.state.currentStepIndex = turnState.currentStep;
      this.state.distanceToNextTurn = turnState.distanceToNextTurn;
      this.state.isOffRoute = turnState.isOffRoute;
      this.state.offRouteDistance = turnState.offRouteDistance;

      // 計算 ETA
      if (this.state.averageSpeed > 0) {
        this.state.eta = (this.route.totalDistance - this.state.totalDistanceTraveled) / this.state.averageSpeed;
      }

      // 檢查轉向提示
      await this.checkTurnNotification(turnState);

      // 檢查偏離路線
      if (turnState.isOffRoute && turnState.offRouteDistance > OFF_ROUTE_THRESHOLD) {
        this.notifyListeners({
          type: 'off-route',
          timestamp: Date.now(),
          data: {
            distance: turnState.offRouteDistance,
            location: currentLocation,
          },
        });

        // 播放偏離路線提示
        await this.voiceManager.checkAndPlayTurnNotification(
          turnState.offRouteDistance,
          'off-route',
          '您已偏離路線',
          `您已偏離路線${turnState.offRouteDistance}公尺，請返回主路線`
        );
      } else if (this.state.isOffRoute && !turnState.isOffRoute) {
        // 返回路線
        this.notifyListeners({
          type: 'back-on-route',
          timestamp: Date.now(),
          data: { location: currentLocation },
        });
      }

      this.previousLocation = currentLocation;
    } catch (error) {
      console.error('[RealtimeNavigationManager] Error handling location update:', error);
    }
  }

  /**
   * 檢查轉向提示
   */
  private async checkTurnNotification(turnState: any): Promise<void> {
    try {
      // 避免重複通知同一步驟
      if (turnState.currentStep === this.lastNotifiedStepIndex) {
        return;
      }

      const instruction = this.route?.instructions[turnState.currentStep];
      if (!instruction) {
        return;
      }

      // 檢查是否應該播放提示
      if (turnState.distanceToNextTurn <= 300 && turnState.distanceToNextTurn > 0) {
        // 生成語音文本
        const voiceText = this.generateVoiceText(instruction, turnState.distanceToNextTurn);

        // 播放語音提示
        await this.voiceManager.checkAndPlayTurnNotification(
          turnState.distanceToNextTurn,
          instruction.type,
          instruction.instruction,
          voiceText
        );

        this.lastNotifiedStepIndex = turnState.currentStep;

        // 通知監聽者
        if (turnState.distanceToNextTurn <= 50) {
          this.notifyListeners({
            type: 'immediate-turn',
            timestamp: Date.now(),
            data: { instruction, distance: turnState.distanceToNextTurn },
          });
        } else {
          this.notifyListeners({
            type: 'approaching-turn',
            timestamp: Date.now(),
            data: { instruction, distance: turnState.distanceToNextTurn },
          });
        }
      }

      // 檢查是否完成當前步驟
      if (turnState.distanceToNextTurn < 0) {
        this.notifyListeners({
          type: 'step-completed',
          timestamp: Date.now(),
          data: { instruction, stepIndex: turnState.currentStep },
        });

        this.lastNotifiedStepIndex = -1; // 重置，以便下一步驟可以通知
      }
    } catch (error) {
      console.error('[RealtimeNavigationManager] Error checking turn notification:', error);
    }
  }

  /**
   * 生成語音文本
   */
  private generateVoiceText(instruction: any, distance: number): string {
    const distanceText = distance > 1000 ? `${(distance / 1000).toFixed(1)}公里` : `${Math.round(distance)}公尺`;

    if (distance <= 50) {
      if (instruction.type === 'turn-left') {
        return `立即左轉${instruction.street ? '進入' + instruction.street : ''}`;
      } else if (instruction.type === 'turn-right') {
        return `立即右轉${instruction.street ? '進入' + instruction.street : ''}`;
      }
      return `立即${instruction.instruction}`;
    } else {
      if (instruction.type === 'turn-left') {
        return `${distanceText}後左轉${instruction.street ? '進入' + instruction.street : ''}`;
      } else if (instruction.type === 'turn-right') {
        return `${distanceText}後右轉${instruction.street ? '進入' + instruction.street : ''}`;
      }
      return `${distanceText}後${instruction.instruction}`;
    }
  }

  /**
   * 訂閱導航事件
   */
  subscribe(listener: (event: NavigationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 獲取當前導航狀態
   */
  getState(): NavigationState {
    return { ...this.state };
  }

  /**
   * 獲取軌跡點
   */
  getTrackPoints(): GpxPoint[] {
    return [...this.trackPoints];
  }

  /**
   * 導出軌跡為 GPX
   */
  exportTrackAsGpx(): string {
    const points = this.trackPoints;
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1">\n';
    gpx += '  <trk>\n';
    gpx += '    <trkseg>\n';

    for (const point of points) {
      gpx += `      <trkpt lat="${point.latitude}" lon="${point.longitude}">\n`;
      if (point.elevation !== undefined) {
        gpx += `        <ele>${point.elevation}</ele>\n`;
      }
      if (point.timestamp) {
        const date = new Date(point.timestamp).toISOString();
        gpx += `        <time>${date}</time>\n`;
      }
      gpx += '      </trkpt>\n';
    }

    gpx += '    </trkseg>\n';
    gpx += '  </trk>\n';
    gpx += '</gpx>\n';

    return gpx;
  }

  /**
   * 計算兩點之間的距離（Haversine 公式）
   */
  private haversineDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371000; // 地球半徑（米）
    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const deltaLat = ((p2[0] - p1[0]) * Math.PI) / 180;
    const deltaLon = ((p2[1] - p1[1]) * Math.PI) / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(event: NavigationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[RealtimeNavigationManager] Error in listener:', error);
      }
    }
  }

  /**
   * 清理資源
   */
  async destroy(): Promise<void> {
    await this.stopNavigation();
    this.listeners.clear();
    console.log('[RealtimeNavigationManager] Destroyed');
  }
}

// 全局單例
let managerInstance: RealtimeNavigationManager | null = null;

export function getRealtimeNavigationManager(): RealtimeNavigationManager {
  if (!managerInstance) {
    managerInstance = new RealtimeNavigationManager();
  }
  return managerInstance;
}
