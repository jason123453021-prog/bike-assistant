import { LocalStorageManager } from './local-storage-manager';

/**
 * 個性化推薦引擎
 */
export class PersonalizationEngine {
  /**
   * 分析用戶騎乘風格
   */
  static async analyzeRidingStyle() {
    const records = await LocalStorageManager.getAllRideRecords();

    if (records.length === 0) {
      return { style: 'beginner', avgDistance: 0, avgSpeed: 0, avgDuration: 0 };
    }

    const avgDistance = records.reduce((s, r) => s + (r.distance || 0), 0) / records.length;
    const avgSpeed = records.reduce((s, r) => s + (r.speed || 0), 0) / records.length;
    const avgDuration = records.reduce((s, r) => s + (r.duration || 0), 0) / records.length;

    let style = 'beginner';
    if (avgDistance > 50 && avgSpeed > 25) {
      style = 'advanced';
    } else if (avgDistance > 30 && avgSpeed > 20) {
      style = 'intermediate';
    }

    return { style, avgDistance, avgSpeed, avgDuration };
  }

  /**
   * 根據騎乘風格生成個性化路線推薦
   */
  static async generatePersonalizedRoutes() {
    const rideStyle = await this.analyzeRidingStyle();

    const routes = [
      {
        id: 1,
        name: '城市環線',
        distance: 25,
        difficulty: 'easy',
        match: rideStyle.style === 'beginner' ? 0.9 : 0.6,
      },
      {
        id: 2,
        name: '郊外爬升',
        distance: 50,
        difficulty: 'hard',
        match: rideStyle.style === 'advanced' ? 0.95 : 0.5,
      },
      {
        id: 3,
        name: '山地挑戰',
        distance: 80,
        difficulty: 'extreme',
        match: rideStyle.style === 'advanced' ? 0.85 : 0.2,
      },
      {
        id: 4,
        name: '海濱騎行',
        distance: 40,
        difficulty: 'medium',
        match: rideStyle.style === 'intermediate' ? 0.9 : 0.7,
      },
    ];

    return routes.sort((a, b) => b.match - a.match);
  }

  /**
   * 根據騎乘風格生成個性化訓練計劃
   */
  static async generatePersonalizedTrainingPlan() {
    const rideStyle = await this.analyzeRidingStyle();

    const plans = {
      beginner: [
        { day: '週一', type: '耐力訓練', duration: 45, intensity: 60 },
        { day: '週三', type: '恢復騎行', duration: 30, intensity: 50 },
        { day: '週五', type: '基礎訓練', duration: 60, intensity: 65 },
      ],
      intermediate: [
        { day: '週一', type: '間歇訓練', duration: 60, intensity: 75 },
        { day: '週三', type: '耐力訓練', duration: 90, intensity: 70 },
        { day: '週五', type: '爬升訓練', duration: 75, intensity: 80 },
      ],
      advanced: [
        { day: '週一', type: '高強度間歇', duration: 60, intensity: 90 },
        { day: '週三', type: '長距離耐力', duration: 120, intensity: 75 },
        { day: '週五', type: '山地技巧', duration: 90, intensity: 85 },
      ],
    };

    return plans[rideStyle.style as keyof typeof plans] || plans.beginner;
  }

  /**
   * 根據騎乘風格生成個性化天氣建議
   */
  static async generateWeatherRecommendation(weather: any) {
    const rideStyle = await this.analyzeRidingStyle();

    const recommendations = {
      beginner: {
        ideal: 'sunny',
        acceptable: ['cloudy', 'light_rain'],
        avoid: ['heavy_rain', 'storm'],
      },
      intermediate: {
        ideal: 'sunny',
        acceptable: ['cloudy', 'light_rain', 'windy'],
        avoid: ['heavy_rain', 'storm'],
      },
      advanced: {
        ideal: 'any',
        acceptable: ['any'],
        avoid: ['storm'],
      },
    };

    const rec = recommendations[rideStyle.style as keyof typeof recommendations] || recommendations.beginner;

    return {
      isIdeal: rec.ideal === weather.condition,
      isAcceptable: rec.acceptable.includes(weather.condition),
      shouldAvoid: rec.avoid.includes(weather.condition),
      recommendation: rec.shouldAvoid?.includes(weather.condition)
        ? `當前天氣不適合騎乘 (${weather.condition})`
        : `天氣適合騎乘`,
    };
  }

  /**
   * 根據騎乘歷史生成進度建議
   */
  static async generateProgressRecommendation() {
    const records = await LocalStorageManager.getAllRideRecords();

    if (records.length < 3) {
      return '開始記錄更多騎乘以獲得個性化建議';
    }

    const recentRecords = records.slice(-7);
    const totalDistance = recentRecords.reduce((s, r) => s + (r.distance || 0), 0);
    const avgDistance = totalDistance / recentRecords.length;

    if (avgDistance < 20) {
      return '建議逐漸增加騎乘距離，每週增加 10% 以避免過度訓練';
    } else if (avgDistance < 50) {
      return '你的進度很好！建議嘗試不同類型的訓練（間歇、爬升等）';
    } else {
      return '你已達到進階水平，建議參加挑戰或隊伍競賽以保持動力';
    }
  }
}
