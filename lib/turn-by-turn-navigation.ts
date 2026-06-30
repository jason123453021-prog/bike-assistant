import type { LocationObject } from 'expo-location';

export interface TurnInstruction {
  id: string;
  type: 'start' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'u-turn' | 'straight' | 'arrive';
  direction: 'left' | 'right' | 'straight' | 'back';
  angle: number; // 轉向角度（度）
  distance: number; // 距離下一個轉向點（米）
  street?: string; // 街道名稱
  instruction: string; // 人類可讀的指令
  coordinates: [number, number]; // 轉向點座標 [lat, lng]
  nextCoordinates?: [number, number]; // 下一個轉向點座標
}

export interface NavigationState {
  currentStep: number;
  totalSteps: number;
  currentInstruction?: TurnInstruction;
  nextInstruction?: TurnInstruction;
  distanceToNextTurn: number; // 距離下一個轉向點（米）
  distanceToDestination: number; // 距離目的地（米）
  isOffRoute: boolean;
  offRouteDistance: number; // 偏離路線的距離（米）
}

/**
 * 轉向導航管理器
 * 負責：
 * - 解析 OSRM 或其他路由服務的轉向指令
 * - 追蹤當前導航步驟
 * - 檢測偏離路線
 * - 生成語音提示
 */
export class TurnByTurnNavigationManager {
  private instructions: TurnInstruction[] = [];
  private currentStepIndex = 0;
  private routePolyline: [number, number][] = [];
  private offRouteThreshold = 50; // 50 米視為偏離路線

  /**
   * 初始化導航指令
   */
  setInstructions(instructions: TurnInstruction[], polyline: [number, number][]): void {
    this.instructions = instructions;
    this.routePolyline = polyline;
    this.currentStepIndex = 0;
    console.log(`[TurnByTurnNavigation] Initialized with ${instructions.length} instructions`);
  }

  /**
   * 更新當前位置並獲取導航狀態
   */
  updateLocation(location: LocationObject): NavigationState {
    const currentCoord: [number, number] = [location.coords.latitude, location.coords.longitude];

    // 計算到下一個轉向點的距離
    const distanceToNextTurn = this.getDistanceToNextTurn(currentCoord);

    // 檢測偏離路線
    const { isOffRoute, distance: offRouteDistance } = this.checkOffRoute(currentCoord);

    // 如果接近下一個轉向點，自動推進
    if (distanceToNextTurn < 20 && this.currentStepIndex < this.instructions.length - 1) {
      this.currentStepIndex++;
    }

    const currentInstruction = this.instructions[this.currentStepIndex];
    const nextInstruction = this.instructions[this.currentStepIndex + 1];

    return {
      currentStep: this.currentStepIndex + 1,
      totalSteps: this.instructions.length,
      currentInstruction,
      nextInstruction,
      distanceToNextTurn,
      distanceToDestination: this.getDistanceToDestination(currentCoord),
      isOffRoute,
      offRouteDistance,
    };
  }

  /**
   * 計算到下一個轉向點的距離
   */
  private getDistanceToNextTurn(currentCoord: [number, number]): number {
    if (this.currentStepIndex >= this.instructions.length) {
      return 0;
    }

    const nextTurnCoord = this.instructions[this.currentStepIndex].coordinates;
    return this.haversineDistance(currentCoord, nextTurnCoord);
  }

  /**
   * 計算到目的地的距離
   */
  private getDistanceToDestination(currentCoord: [number, number]): number {
    if (this.instructions.length === 0) {
      return 0;
    }

    const lastInstruction = this.instructions[this.instructions.length - 1];
    return this.haversineDistance(currentCoord, lastInstruction.coordinates);
  }

  /**
   * 檢測是否偏離路線
   */
  private checkOffRoute(currentCoord: [number, number]): { isOffRoute: boolean; distance: number } {
    let minDistance = Infinity;

    // 找到路線上最近的點
    for (const routeCoord of this.routePolyline) {
      const distance = this.haversineDistance(currentCoord, routeCoord);
      minDistance = Math.min(minDistance, distance);
    }

    return {
      isOffRoute: minDistance > this.offRouteThreshold,
      distance: minDistance,
    };
  }

  /**
   * Haversine 公式 - 計算兩點間的距離（米）
   */
  private haversineDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const R = 6371000; // 地球半徑（米）
    const lat1 = (coord1[0] * Math.PI) / 180;
    const lat2 = (coord2[0] * Math.PI) / 180;
    const deltaLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
    const deltaLng = ((coord2[1] - coord1[1]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 獲取當前導航狀態
   */
  getCurrentState(currentCoord: [number, number]): NavigationState {
    const distanceToNextTurn = this.getDistanceToNextTurn(currentCoord);
    const { isOffRoute, distance: offRouteDistance } = this.checkOffRoute(currentCoord);

    const currentInstruction = this.instructions[this.currentStepIndex];
    const nextInstruction = this.instructions[this.currentStepIndex + 1];

    return {
      currentStep: this.currentStepIndex + 1,
      totalSteps: this.instructions.length,
      currentInstruction,
      nextInstruction,
      distanceToNextTurn,
      distanceToDestination: this.getDistanceToDestination(currentCoord),
      isOffRoute,
      offRouteDistance,
    };
  }

  /**
   * 重置導航
   */
  reset(): void {
    this.currentStepIndex = 0;
    this.instructions = [];
    this.routePolyline = [];
  }

  /**
   * 設定偏離路線的閾值
   */
  setOffRouteThreshold(meters: number): void {
    this.offRouteThreshold = meters;
  }

  /**
   * 獲取轉向指令的語音文本
   */
  getTurnVoiceText(instruction: TurnInstruction): string {
    const distanceText = this.formatDistance(instruction.distance);

    switch (instruction.type) {
      case 'start':
        return `開始騎乘${instruction.street ? `沿著 ${instruction.street}` : ''}`;
      case 'turn-left':
        return `在 ${distanceText} 後左轉${instruction.street ? `進入 ${instruction.street}` : ''}`;
      case 'turn-right':
        return `在 ${distanceText} 後右轉${instruction.street ? `進入 ${instruction.street}` : ''}`;
      case 'slight-left':
        return `在 ${distanceText} 後向左靠${instruction.street ? `進入 ${instruction.street}` : ''}`;
      case 'slight-right':
        return `在 ${distanceText} 後向右靠${instruction.street ? `進入 ${instruction.street}` : ''}`;
      case 'u-turn':
        return `在 ${distanceText} 後迴轉`;
      case 'straight':
        return `直行 ${distanceText}${instruction.street ? `沿著 ${instruction.street}` : ''}`;
      case 'arrive':
        return `已到達目的地`;
      default:
        return instruction.instruction;
    }
  }

  /**
   * 格式化距離文本
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} 公尺`;
    } else {
      return `${(meters / 1000).toFixed(1)} 公里`;
    }
  }
}
