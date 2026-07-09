import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrainingPlanManager } from './training-plan-manager';
import { WeatherAlertSystem } from './weather-alert-system';

export interface RidePlan {
  id: string;
  date: number;
  recommendedTime: string; // HH:mm 格式
  recommendedDuration: number; // 分鐘
  recommendedDistance: number; // 公里
  recommendedRoute?: string;
  trainingType: 'recovery' | 'endurance' | 'tempo' | 'threshold' | 'vo2max';
  difficulty: 'easy' | 'moderate' | 'hard';
  weatherScore: number; // 0-100
  bodyConditionScore: number; // 0-100
  motivationScore: number; // 0-100
  overallScore: number; // 0-100
  recommendations: string[];
  warnings: string[];
  createdAt: number;
}

export interface BodyCondition {
  restingHeartRate: number; // bpm
  sleepQuality: number; // 0-10
  muscleRecovery: number; // 0-10
  mood: number; // 0-10
  fatigue: number; // 0-10
  stress: number; // 0-10
  hydration: number; // 0-10
  nutrition: number; // 0-10
}

export interface WeatherCondition {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  uvIndex: number;
  visibility: number;
  conditions: string;
}

const RIDE_PLANS_KEY = 'ride_plans';
const BODY_CONDITION_KEY = 'body_condition';

export class PreRidePlanner {
  /**
   * 評估身體狀況
   */
  static async assessBodyCondition(condition: BodyCondition): Promise<number> {
    try {
      // 保存身體狀況
      await AsyncStorage.setItem(BODY_CONDITION_KEY, JSON.stringify(condition));

      // 計算身體狀況評分
      const score =
        (condition.sleepQuality +
          condition.muscleRecovery +
          condition.mood +
          (10 - condition.fatigue) +
          (10 - condition.stress) +
          condition.hydration +
          condition.nutrition) /
        7;

      return Math.round(score * 10);
    } catch (error) {
      console.error('Failed to assess body condition:', error);
      return 50;
    }
  }

  /**
   * 獲取身體狀況
   */
  static async getBodyCondition(): Promise<BodyCondition | null> {
    try {
      const data = await AsyncStorage.getItem(BODY_CONDITION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get body condition:', error);
      return null;
    }
  }

  /**
   * 評估天氣狀況
   */
  static async assessWeatherCondition(weather: WeatherCondition): Promise<number> {
    try {
      let score = 100;

      // 溫度評分（理想範圍 15-25°C）
      if (weather.temperature < 5 || weather.temperature > 35) {
        score -= 30;
      } else if (weather.temperature < 10 || weather.temperature > 30) {
        score -= 15;
      } else if (weather.temperature < 15 || weather.temperature > 25) {
        score -= 5;
      }

      // 風速評分（理想 < 10 km/h）
      if (weather.windSpeed > 25) {
        score -= 25;
      } else if (weather.windSpeed > 15) {
        score -= 15;
      } else if (weather.windSpeed > 10) {
        score -= 5;
      }

      // 降水評分
      if (weather.precipitation > 5) {
        score -= 30;
      } else if (weather.precipitation > 2) {
        score -= 15;
      }

      // UV 指數評分
      if (weather.uvIndex > 10) {
        score -= 15;
      } else if (weather.uvIndex > 7) {
        score -= 10;
      }

      // 能見度評分
      if (weather.visibility < 1) {
        score -= 20;
      } else if (weather.visibility < 5) {
        score -= 10;
      }

      return Math.max(0, score);
    } catch (error) {
      console.error('Failed to assess weather condition:', error);
      return 50;
    }
  }

  /**
   * 生成騎乘計劃
   */
  static async generateRidePlan(
    date: number,
    weather: WeatherCondition,
    bodyCondition: BodyCondition
  ): Promise<RidePlan> {
    try {
      const bodyScore = await this.assessBodyCondition(bodyCondition);
      const weatherScore = await this.assessWeatherCondition(weather);

      // 根據身體狀況和天氣選擇訓練類型
      const trainingType = this.selectTrainingType(bodyScore, weatherScore);
      const difficulty = this.selectDifficulty(bodyScore, weatherScore);

      // 生成建議
      const recommendations = this.generateRecommendations(
        trainingType,
        weather,
        bodyCondition,
        bodyScore,
        weatherScore
      );

      // 生成警告
      const warnings = this.generateWarnings(weather, bodyCondition);

      // 推薦時間和距離
      const { recommendedTime, recommendedDuration, recommendedDistance } =
        this.calculateRecommendedRide(trainingType, bodyScore);

      // 計算動力評分
      const motivationScore = Math.round((bodyScore + weatherScore) / 2);

      const plan: RidePlan = {
        id: `plan_${date}_${Math.random().toString(36).substr(2, 9)}`,
        date,
        recommendedTime,
        recommendedDuration,
        recommendedDistance,
        trainingType,
        difficulty,
        weatherScore,
        bodyConditionScore: bodyScore,
        motivationScore,
        overallScore: Math.round((bodyScore + weatherScore + motivationScore) / 3),
        recommendations,
        warnings,
        createdAt: Date.now(),
      };

      // 保存計劃
      const plans = await this.getAllRidePlans();
      plans.push(plan);
      await AsyncStorage.setItem(RIDE_PLANS_KEY, JSON.stringify(plans));

      return plan;
    } catch (error) {
      console.error('Failed to generate ride plan:', error);
      throw error;
    }
  }

  /**
   * 選擇訓練類型
   */
  private static selectTrainingType(
    bodyScore: number,
    weatherScore: number
  ): 'recovery' | 'endurance' | 'tempo' | 'threshold' | 'vo2max' {
    const combinedScore = (bodyScore + weatherScore) / 2;

    if (combinedScore < 40) {
      return 'recovery';
    } else if (combinedScore < 55) {
      return 'endurance';
    } else if (combinedScore < 70) {
      return 'tempo';
    } else if (combinedScore < 85) {
      return 'threshold';
    } else {
      return 'vo2max';
    }
  }

  /**
   * 選擇難度
   */
  private static selectDifficulty(
    bodyScore: number,
    weatherScore: number
  ): 'easy' | 'moderate' | 'hard' {
    const combinedScore = (bodyScore + weatherScore) / 2;

    if (combinedScore < 50) {
      return 'easy';
    } else if (combinedScore < 75) {
      return 'moderate';
    } else {
      return 'hard';
    }
  }

  /**
   * 生成建議
   */
  private static generateRecommendations(
    trainingType: string,
    weather: WeatherCondition,
    bodyCondition: BodyCondition,
    bodyScore: number,
    weatherScore: number
  ): string[] {
    const recommendations: string[] = [];

    // 訓練類型建議
    if (trainingType === 'recovery') {
      recommendations.push('今天適合輕鬆恢復騎乘，保持低強度');
    } else if (trainingType === 'endurance') {
      recommendations.push('今天適合耐力訓練，保持穩定的中等強度');
    } else if (trainingType === 'threshold') {
      recommendations.push('今天適合閾值訓練，挑戰自己的極限');
    }

    // 天氣建議
    if (weather.temperature < 10) {
      recommendations.push('天氣寒冷，記得穿著保暖衣物');
    }
    if (weather.windSpeed > 15) {
      recommendations.push('風力較大，選擇背風路線會更舒適');
    }
    if (weather.uvIndex > 7) {
      recommendations.push('紫外線強烈，記得擦防曬霜');
    }

    // 身體狀況建議
    if (bodyCondition.fatigue > 7) {
      recommendations.push('疲勞程度較高，建議縮短騎乘時間');
    }
    if (bodyCondition.hydration < 5) {
      recommendations.push('補水狀況不佳，騎乘中記得多喝水');
    }
    if (bodyCondition.sleepQuality < 5) {
      recommendations.push('睡眠品質不佳，建議今天輕鬆騎乘');
    }

    return recommendations;
  }

  /**
   * 生成警告
   */
  private static generateWarnings(weather: WeatherCondition, bodyCondition: BodyCondition): string[] {
    const warnings: string[] = [];

    if (weather.temperature < 0) {
      warnings.push('⚠️ 氣溫低於冰點，騎乘風險較高');
    }
    if (weather.windSpeed > 30) {
      warnings.push('⚠️ 風力過大，不建議騎乘');
    }
    if (weather.precipitation > 10) {
      warnings.push('⚠️ 降雨量大，建議延後騎乘');
    }
    if (bodyCondition.fatigue > 9) {
      warnings.push('⚠️ 疲勞程度極高，建議休息');
    }
    if (bodyCondition.stress > 8) {
      warnings.push('⚠️ 壓力過大，騎乘前放鬆心情');
    }

    return warnings;
  }

  /**
   * 計算推薦騎乘
   */
  private static calculateRecommendedRide(trainingType: string, bodyScore: number) {
    const baseTime = 60; // 基礎時間 60 分鐘
    const baseDistance = 30; // 基礎距離 30 km

    let timeFactor = 1;
    let distanceFactor = 1;

    // 根據訓練類型調整
    if (trainingType === 'recovery') {
      timeFactor = 0.5;
      distanceFactor = 0.5;
    } else if (trainingType === 'endurance') {
      timeFactor = 1.2;
      distanceFactor = 1.2;
    } else if (trainingType === 'threshold') {
      timeFactor = 0.8;
      distanceFactor = 0.8;
    }

    // 根據身體狀況調整
    const bodyFactor = Math.max(0.5, bodyScore / 100);

    const recommendedTime = Math.round(baseTime * timeFactor * bodyFactor);
    const recommendedDistance = Math.round(baseDistance * distanceFactor * bodyFactor);

    // 推薦時間（早上 6-7 點或傍晚 5-6 點）
    const hour = new Date().getHours();
    const recommendedTime_str = hour < 12 ? '06:30' : '17:30';

    return {
      recommendedTime: recommendedTime_str,
      recommendedDuration: recommendedTime,
      recommendedDistance,
    };
  }

  /**
   * 獲取所有騎乘計劃
   */
  static async getAllRidePlans(): Promise<RidePlan[]> {
    try {
      const data = await AsyncStorage.getItem(RIDE_PLANS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all ride plans:', error);
      return [];
    }
  }

  /**
   * 獲取今日計劃
   */
  static async getTodayPlan(): Promise<RidePlan | null> {
    try {
      const plans = await this.getAllRidePlans();
      const today = new Date().toDateString();

      return (
        plans.find((p) => new Date(p.date).toDateString() === today) || null
      );
    } catch (error) {
      console.error('Failed to get today plan:', error);
      return null;
    }
  }

  /**
   * 計算最佳騎乘時間
   */
  static async calculateBestRideTime(weather: WeatherCondition[]): Promise<string> {
    try {
      let bestTimeIndex = 0;
      let bestScore = 0;

      for (let i = 0; i < weather.length; i++) {
        const score = await this.assessWeatherCondition(weather[i]);
        if (score > bestScore) {
          bestScore = score;
          bestTimeIndex = i;
        }
      }

      return `${bestTimeIndex + 6}:00`; // 假設從 6:00 開始
    } catch (error) {
      console.error('Failed to calculate best ride time:', error);
      return '09:00';
    }
  }
}
