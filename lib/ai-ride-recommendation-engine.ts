import AsyncStorage from '@react-native-async-storage/async-storage';
import { RideAnalytics } from './ride-analytics-dashboard';
import { PreRidePlanner, RidePlan } from './pre-ride-planner';

export interface RideRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'route' | 'training' | 'recovery' | 'challenge';
  difficulty: 'easy' | 'moderate' | 'hard';
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedElevation: number;
  reason: string;
  score: number; // 0-100
  tags: string[];
  createdAt: number;
}

export interface RouteRecommendation extends RideRecommendation {
  type: 'route';
  waypoints: Array<{ lat: number; lon: number }>;
  terrain: string;
  scenery: string;
  traffic: string;
}

export interface TrainingRecommendation extends RideRecommendation {
  type: 'training';
  trainingType: 'recovery' | 'endurance' | 'tempo' | 'threshold' | 'vo2max';
  intervals?: Array<{ duration: number; intensity: number }>;
  targetPower?: number;
  targetHeartRate?: number;
}

const RECOMMENDATIONS_KEY = 'ai_recommendations';
const RIDE_HISTORY_KEY = 'ride_history';

export class AIRideRecommendationEngine {
  /**
   * 分析騎乘歷史
   */
  static async analyzeRideHistory(): Promise<{
    totalRides: number;
    averageDistance: number;
    averageDuration: number;
    averageElevation: number;
    favoriteType: string;
    progressTrend: number; // -1 to 1
    consistencyScore: number; // 0-100
  }> {
    try {
      const history = await this.getRideHistory();

      if (history.length === 0) {
        return {
          totalRides: 0,
          averageDistance: 0,
          averageDuration: 0,
          averageElevation: 0,
          favoriteType: 'endurance',
          progressTrend: 0,
          consistencyScore: 0,
        };
      }

      const avgDistance = history.reduce((sum, r) => sum + r.distance, 0) / history.length;
      const avgDuration = history.reduce((sum, r) => sum + r.duration, 0) / history.length;
      const avgElevation = history.reduce((sum, r) => sum + r.elevation, 0) / history.length;

      // 計算進度趨勢
      const recentAvg = history.slice(0, 5).reduce((sum, r) => sum + r.distance, 0) / Math.min(5, history.length);
      const olderAvg = history.slice(-5).reduce((sum, r) => sum + r.distance, 0) / Math.min(5, history.length);
      const progressTrend = (recentAvg - olderAvg) / olderAvg;

      // 計算一致性評分
      const distances = history.map((r) => r.distance);
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);
      const consistencyScore = Math.max(0, 100 - (stdDev / avgDistance) * 100);

      return {
        totalRides: history.length,
        averageDistance: avgDistance,
        averageDuration: avgDuration,
        averageElevation: avgElevation,
        favoriteType: 'endurance',
        progressTrend: Math.max(-1, Math.min(1, progressTrend)),
        consistencyScore: Math.round(consistencyScore),
      };
    } catch (error) {
      console.error('Failed to analyze ride history:', error);
      return {
        totalRides: 0,
        averageDistance: 0,
        averageDuration: 0,
        averageElevation: 0,
        favoriteType: 'endurance',
        progressTrend: 0,
        consistencyScore: 0,
      };
    }
  }

  /**
   * 生成個性化騎乘建議
   */
  static async generatePersonalizedRecommendations(
    ridePlan: RidePlan
  ): Promise<RideRecommendation[]> {
    try {
      const history = await this.analyzeRideHistory();
      const recommendations: RideRecommendation[] = [];

      // 基於進度趨勢的建議
      if (history.progressTrend > 0.1) {
        recommendations.push({
          id: `rec_${Date.now()}_1`,
          title: '挑戰進階路線',
          description: '你的進度不錯，是時候挑戰更難的路線了',
          type: 'route',
          difficulty: 'hard',
          estimatedDistance: history.averageDistance * 1.2,
          estimatedDuration: history.averageDuration * 1.2,
          estimatedElevation: history.averageElevation * 1.3,
          reason: '基於你最近的進度提升',
          score: 85,
          tags: ['挑戰', '進階', '進度'],
          createdAt: Date.now(),
        });
      } else if (history.progressTrend < -0.1) {
        recommendations.push({
          id: `rec_${Date.now()}_2`,
          title: '恢復性騎乘',
          description: '最近進度有所下降，建議進行恢復性騎乘',
          type: 'recovery',
          difficulty: 'easy',
          estimatedDistance: history.averageDistance * 0.7,
          estimatedDuration: history.averageDuration * 0.7,
          estimatedElevation: history.averageElevation * 0.5,
          reason: '基於你最近的表現調整',
          score: 75,
          tags: ['恢復', '輕鬆', '調整'],
          createdAt: Date.now(),
        });
      }

      // 基於一致性的建議
      if (history.consistencyScore < 50) {
        recommendations.push({
          id: `rec_${Date.now()}_3`,
          title: '建立規律騎乘習慣',
          description: '嘗試建立更規律的騎乘計劃',
          type: 'training',
          difficulty: 'moderate',
          estimatedDistance: history.averageDistance,
          estimatedDuration: history.averageDuration,
          estimatedElevation: history.averageElevation,
          reason: '提高騎乘的規律性和效率',
          score: 70,
          tags: ['習慣', '規律', '計劃'],
          createdAt: Date.now(),
        });
      }

      // 基於騎乘計劃的建議
      if (ridePlan.trainingType === 'threshold') {
        recommendations.push({
          id: `rec_${Date.now()}_4`,
          title: '閾值訓練路線',
          description: '根據今天的訓練計劃推薦閾值訓練路線',
          type: 'training',
          difficulty: 'hard',
          estimatedDistance: history.averageDistance * 0.9,
          estimatedDuration: history.averageDuration * 0.9,
          estimatedElevation: history.averageElevation * 0.8,
          reason: '匹配你今天的訓練計劃',
          score: 90,
          tags: ['訓練', '閾值', '高強度'],
          createdAt: Date.now(),
        });
      }

      // 基於天氣的建議
      if (ridePlan.weatherScore > 80) {
        recommendations.push({
          id: `rec_${Date.now()}_5`,
          title: '戶外長距離騎乘',
          description: '天氣很好，適合進行長距離騎乘',
          type: 'route',
          difficulty: 'moderate',
          estimatedDistance: history.averageDistance * 1.3,
          estimatedDuration: history.averageDuration * 1.3,
          estimatedElevation: history.averageElevation,
          reason: '天氣條件優越',
          score: 88,
          tags: ['天氣', '長距離', '戶外'],
          createdAt: Date.now(),
        });
      }

      // 保存建議
      await AsyncStorage.setItem(RECOMMENDATIONS_KEY, JSON.stringify(recommendations));

      return recommendations;
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return [];
    }
  }

  /**
   * 推薦最佳路線
   */
  static async recommendBestRoute(
    distance: number,
    elevation: number,
    difficulty: 'easy' | 'moderate' | 'hard'
  ): Promise<RouteRecommendation> {
    try {
      const recommendation: RouteRecommendation = {
        id: `route_${Date.now()}`,
        title: `${difficulty === 'easy' ? '輕鬆' : difficulty === 'moderate' ? '中等' : '挑戰'}路線推薦`,
        description: `推薦${distance.toFixed(1)}km、爬升${elevation}m 的${difficulty === 'easy' ? '輕鬆' : difficulty === 'moderate' ? '中等' : '挑戰'}難度路線`,
        type: 'route',
        difficulty,
        estimatedDistance: distance,
        estimatedDuration: this.calculateDuration(distance, elevation),
        estimatedElevation: elevation,
        reason: '基於你的偏好和體能狀況',
        score: 85,
        tags: ['推薦', '路線', difficulty],
        waypoints: this.generateWaypoints(),
        terrain: this.selectTerrain(difficulty),
        scenery: this.selectScenery(difficulty),
        traffic: 'low',
        createdAt: Date.now(),
      };

      return recommendation;
    } catch (error) {
      console.error('Failed to recommend route:', error);
      throw error;
    }
  }

  /**
   * 推薦訓練計劃
   */
  static async recommendTrainingPlan(
    trainingType: 'recovery' | 'endurance' | 'tempo' | 'threshold' | 'vo2max'
  ): Promise<TrainingRecommendation> {
    try {
      const intervals = this.generateIntervals(trainingType);
      const targetPower = this.calculateTargetPower(trainingType);
      const targetHeartRate = this.calculateTargetHeartRate(trainingType);

      const recommendation: TrainingRecommendation = {
        id: `training_${Date.now()}`,
        title: `${trainingType} 訓練計劃`,
        description: `個性化的${trainingType}訓練計劃`,
        type: 'training',
        trainingType,
        difficulty: trainingType === 'recovery' ? 'easy' : trainingType === 'endurance' ? 'moderate' : 'hard',
        estimatedDistance: this.estimateDistance(trainingType),
        estimatedDuration: this.estimateDuration(trainingType),
        estimatedElevation: this.estimateElevation(trainingType),
        reason: '基於你的訓練目標',
        score: 90,
        tags: ['訓練', trainingType],
        intervals,
        targetPower,
        targetHeartRate,
        createdAt: Date.now(),
      };

      return recommendation;
    } catch (error) {
      console.error('Failed to recommend training plan:', error);
      throw error;
    }
  }

  /**
   * 獲取騎乘歷史
   */
  private static async getRideHistory(): Promise<RideAnalytics[]> {
    try {
      const data = await AsyncStorage.getItem(RIDE_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get ride history:', error);
      return [];
    }
  }

  /**
   * 計算騎乘時長
   */
  private static calculateDuration(distance: number, elevation: number): number {
    // 假設平均速度 25 km/h，每 100m 爬升增加 5 分鐘
    const baseDuration = (distance / 25) * 60;
    const elevationTime = (elevation / 100) * 5;
    return Math.round(baseDuration + elevationTime);
  }

  /**
   * 生成路線點
   */
  private static generateWaypoints(): Array<{ lat: number; lon: number }> {
    // 模擬路線點
    return [
      { lat: 25.033, lon: 121.565 },
      { lat: 25.035, lon: 121.568 },
      { lat: 25.038, lon: 121.570 },
      { lat: 25.040, lon: 121.573 },
      { lat: 25.043, lon: 121.575 },
    ];
  }

  /**
   * 選擇地形
   */
  private static selectTerrain(difficulty: string): string {
    if (difficulty === 'easy') return '平坦';
    if (difficulty === 'moderate') return '起伏';
    return '山地';
  }

  /**
   * 選擇風景
   */
  private static selectScenery(difficulty: string): string {
    if (difficulty === 'easy') return '城市';
    if (difficulty === 'moderate') return '郊外';
    return '山區';
  }

  /**
   * 生成間歇訓練
   */
  private static generateIntervals(
    trainingType: string
  ): Array<{ duration: number; intensity: number }> {
    if (trainingType === 'recovery') {
      return [{ duration: 60, intensity: 0.5 }];
    } else if (trainingType === 'endurance') {
      return [{ duration: 120, intensity: 0.7 }];
    } else if (trainingType === 'threshold') {
      return [
        { duration: 10, intensity: 0.6 },
        { duration: 20, intensity: 0.85 },
        { duration: 10, intensity: 0.6 },
      ];
    } else if (trainingType === 'vo2max') {
      return [
        { duration: 5, intensity: 0.7 },
        { duration: 3, intensity: 1.0 },
        { duration: 2, intensity: 0.5 },
      ];
    }
    return [{ duration: 60, intensity: 0.7 }];
  }

  /**
   * 計算目標功率
   */
  private static calculateTargetPower(trainingType: string): number {
    // 假設 FTP = 250W
    const ftp = 250;

    if (trainingType === 'recovery') return Math.round(ftp * 0.5);
    if (trainingType === 'endurance') return Math.round(ftp * 0.75);
    if (trainingType === 'tempo') return Math.round(ftp * 0.85);
    if (trainingType === 'threshold') return Math.round(ftp * 1.0);
    if (trainingType === 'vo2max') return Math.round(ftp * 1.2);

    return ftp;
  }

  /**
   * 計算目標心率
   */
  private static calculateTargetHeartRate(trainingType: string): number {
    // 假設最大心率 = 190 bpm
    const maxHR = 190;

    if (trainingType === 'recovery') return Math.round(maxHR * 0.5);
    if (trainingType === 'endurance') return Math.round(maxHR * 0.7);
    if (trainingType === 'tempo') return Math.round(maxHR * 0.8);
    if (trainingType === 'threshold') return Math.round(maxHR * 0.9);
    if (trainingType === 'vo2max') return Math.round(maxHR * 0.95);

    return maxHR;
  }

  /**
   * 估計距離
   */
  private static estimateDistance(trainingType: string): number {
    if (trainingType === 'recovery') return 20;
    if (trainingType === 'endurance') return 50;
    if (trainingType === 'tempo') return 40;
    if (trainingType === 'threshold') return 35;
    if (trainingType === 'vo2max') return 30;
    return 40;
  }

  /**
   * 估計時長
   */
  private static estimateDuration(trainingType: string): number {
    if (trainingType === 'recovery') return 90;
    if (trainingType === 'endurance') return 180;
    if (trainingType === 'tempo') return 120;
    if (trainingType === 'threshold') return 100;
    if (trainingType === 'vo2max') return 80;
    return 120;
  }

  /**
   * 估計爬升
   */
  private static estimateElevation(trainingType: string): number {
    if (trainingType === 'recovery') return 100;
    if (trainingType === 'endurance') return 300;
    if (trainingType === 'tempo') return 250;
    if (trainingType === 'threshold') return 200;
    if (trainingType === 'vo2max') return 150;
    return 200;
  }
}
