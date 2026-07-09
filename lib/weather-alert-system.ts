import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeatherAlert {
  id: string;
  type: 'severe_wind' | 'heavy_rain' | 'extreme_temp' | 'lightning' | 'poor_visibility';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  description?: string;
  startTime: number;
  endTime: number;
  affectedArea?: {
    latitude: number;
    longitude: number;
    radius: number; // 公里
  };
  recommendations?: string[];
  createdAt: number;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number; // 攝氏度
  feelsLike: number;
  humidity: number; // 百分比
  windSpeed: number; // km/h
  windGust: number; // km/h
  windDirection: number; // 度數
  precipitation: number; // mm
  precipitationProb: number; // 百分比
  visibility: number; // 米
  uvIndex: number;
  weatherCode: number;
  description: string;
  cloudCover: number; // 百分比
  pressure: number; // hPa
  dewPoint: number; // 攝氏度
  timestamp: number;
}

export interface WeatherForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  description: string;
  windSpeed: number;
  windGust: number;
  precipitation: number;
  precipitationProb: number;
  uvIndex: number;
}

const WEATHER_ALERTS_KEY = 'weather_alerts';
const WEATHER_PREFERENCES_KEY = 'weather_preferences';

export class WeatherAlertSystem {
  private static alertThresholds = {
    windSpeed: 40, // km/h
    windGust: 60, // km/h
    temperature: { min: -5, max: 40 }, // 攝氏度
    precipitation: 10, // mm/h
    visibility: 1000, // 米
    uvIndex: 8,
  };

  /**
   * 初始化天氣預警系統
   */
  static async initialize(): Promise<void> {
    try {
      // 創建默認偏好設置
      const prefs = await AsyncStorage.getItem(WEATHER_PREFERENCES_KEY);
      if (!prefs) {
        await AsyncStorage.setItem(
          WEATHER_PREFERENCES_KEY,
          JSON.stringify({
            enableAlerts: true,
            notifyOnSevereWind: true,
            notifyOnHeavyRain: true,
            notifyOnExtremeTemp: true,
            notifyOnLightning: true,
            notifyOnPoorVisibility: true,
            checkInterval: 300000, // 5 分鐘
          })
        );
      }
    } catch (error) {
      console.error('Failed to initialize weather alert system:', error);
    }
  }

  /**
   * 檢查天氣數據並生成警報
   */
  static async checkWeatherAndGenerateAlerts(weatherData: WeatherData): Promise<WeatherAlert[]> {
    try {
      const alerts: WeatherAlert[] = [];
      const now = Date.now();

      // 檢查風速
      if (weatherData.windSpeed > this.alertThresholds.windSpeed) {
        alerts.push({
          id: `alert_${now}_wind`,
          type: 'severe_wind',
          severity: weatherData.windGust > this.alertThresholds.windGust ? 'critical' : 'high',
          message: `⚠️ 強風警報：風速 ${weatherData.windSpeed} km/h`,
          description: `風速達到 ${weatherData.windSpeed} km/h，陣風 ${weatherData.windGust} km/h。騎乘時請小心。`,
          startTime: now,
          endTime: now + 3600000, // 1 小時
          recommendations: [
            '減速騎乘',
            '避免高速下坡',
            '增加制動距離',
            '考慮暫停騎乘',
          ],
          createdAt: now,
        });
      }

      // 檢查降水
      if (weatherData.precipitation > this.alertThresholds.precipitation || weatherData.precipitationProb > 80) {
        alerts.push({
          id: `alert_${now}_rain`,
          type: 'heavy_rain',
          severity: weatherData.precipitation > 20 ? 'critical' : 'high',
          message: `🌧️ 大雨警報：降水 ${weatherData.precipitation} mm/h`,
          description: `預計降水量 ${weatherData.precipitation} mm/h，概率 ${weatherData.precipitationProb}%。`,
          startTime: now,
          endTime: now + 3600000,
          recommendations: [
            '穿著防水服裝',
            '檢查煞車狀況',
            '降低騎乘速度',
            '避免濕滑路面',
          ],
          createdAt: now,
        });
      }

      // 檢查極端溫度
      if (
        weatherData.temperature < this.alertThresholds.temperature.min ||
        weatherData.temperature > this.alertThresholds.temperature.max
      ) {
        const isCold = weatherData.temperature < this.alertThresholds.temperature.min;
        alerts.push({
          id: `alert_${now}_temp`,
          type: 'extreme_temp',
          severity: isCold ? 'high' : 'medium',
          message: `${isCold ? '❄️' : '🔥'} 極端溫度警報：${weatherData.temperature}°C`,
          description: `溫度 ${weatherData.temperature}°C，體感溫度 ${weatherData.feelsLike}°C。`,
          startTime: now,
          endTime: now + 7200000,
          recommendations: isCold
            ? [
                '穿著保暖衣物',
                '戴手套和帽子',
                '定期休息取暖',
                '補充熱飲',
              ]
            : [
                '穿著透氣衣物',
                '定期補充水分',
                '避免中午騎乘',
                '塗抹防曬霜',
              ],
          createdAt: now,
        });
      }

      // 檢查能見度
      if (weatherData.visibility < this.alertThresholds.visibility) {
        alerts.push({
          id: `alert_${now}_visibility`,
          type: 'poor_visibility',
          severity: weatherData.visibility < 500 ? 'critical' : 'high',
          message: `🌫️ 能見度低警報：${weatherData.visibility} 米`,
          description: `能見度只有 ${weatherData.visibility} 米，騎乘時請小心。`,
          startTime: now,
          endTime: now + 3600000,
          recommendations: [
            '打開車燈',
            '穿著反光衣物',
            '降低騎乘速度',
            '增加警惕',
          ],
          createdAt: now,
        });
      }

      // 檢查紫外線指數
      if (weatherData.uvIndex > this.alertThresholds.uvIndex) {
        alerts.push({
          id: `alert_${now}_uv`,
          type: 'extreme_temp', // 重複使用類型
          severity: 'medium',
          message: `☀️ 紫外線強警報：UV 指數 ${weatherData.uvIndex}`,
          description: `紫外線指數達到 ${weatherData.uvIndex}，屬於極端等級。`,
          startTime: now,
          endTime: now + 7200000,
          recommendations: [
            '塗抹防曬霜（SPF 50+）',
            '穿著長袖衣物',
            '戴太陽眼鏡',
            '定期補充水分',
          ],
          createdAt: now,
        });
      }

      // 保存警報
      if (alerts.length > 0) {
        await this.saveAlerts(alerts);
      }

      return alerts;
    } catch (error) {
      console.error('Failed to check weather and generate alerts:', error);
      return [];
    }
  }

  /**
   * 保存警報
   */
  private static async saveAlerts(newAlerts: WeatherAlert[]): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(WEATHER_ALERTS_KEY);
      const existingAlerts: WeatherAlert[] = stored ? JSON.parse(stored) : [];

      // 移除過期警報
      const now = Date.now();
      const activeAlerts = existingAlerts.filter((a) => a.endTime > now);

      // 合併新警報
      const merged = [...activeAlerts, ...newAlerts];

      // 去重
      const unique = Array.from(
        new Map(merged.map((a) => [a.type, a])).values()
      );

      await AsyncStorage.setItem(WEATHER_ALERTS_KEY, JSON.stringify(unique));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }

  /**
   * 獲取活躍警報
   */
  static async getActiveAlerts(): Promise<WeatherAlert[]> {
    try {
      const stored = await AsyncStorage.getItem(WEATHER_ALERTS_KEY);
      if (!stored) return [];

      const alerts: WeatherAlert[] = JSON.parse(stored);
      const now = Date.now();

      // 過濾活躍警報
      return alerts.filter((a) => a.endTime > now);
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * 獲取特定類型的警報
   */
  static async getAlertsByType(type: WeatherAlert['type']): Promise<WeatherAlert[]> {
    try {
      const alerts = await this.getActiveAlerts();
      return alerts.filter((a) => a.type === type);
    } catch (error) {
      console.error('Failed to get alerts by type:', error);
      return [];
    }
  }

  /**
   * 獲取最嚴重的警報
   */
  static async getCriticalAlerts(): Promise<WeatherAlert[]> {
    try {
      const alerts = await this.getActiveAlerts();
      return alerts.filter((a) => a.severity === 'critical');
    } catch (error) {
      console.error('Failed to get critical alerts:', error);
      return [];
    }
  }

  /**
   * 清除警報
   */
  static async clearAlerts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WEATHER_ALERTS_KEY);
    } catch (error) {
      console.error('Failed to clear alerts:', error);
    }
  }

  /**
   * 獲取天氣偏好設置
   */
  static async getPreferences(): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem(WEATHER_PREFERENCES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get preferences:', error);
      return {};
    }
  }

  /**
   * 更新天氣偏好設置
   */
  static async updatePreferences(preferences: any): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...preferences };
      await AsyncStorage.setItem(WEATHER_PREFERENCES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  }

  /**
   * 調整警報閾值
   */
  static setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  /**
   * 獲取天氣建議
   */
  static getWeatherRecommendations(weatherData: WeatherData): string[] {
    const recommendations: string[] = [];

    if (weatherData.windSpeed > 30) {
      recommendations.push('風速較大，請減速騎乘');
    }

    if (weatherData.precipitation > 5) {
      recommendations.push('有降水，請穿著防水服裝');
    }

    if (weatherData.temperature < 5) {
      recommendations.push('溫度較低，請穿著保暖衣物');
    }

    if (weatherData.temperature > 30) {
      recommendations.push('溫度較高，請定期補充水分');
    }

    if (weatherData.uvIndex > 6) {
      recommendations.push('紫外線強，請塗抹防曬霜');
    }

    if (weatherData.visibility < 2000) {
      recommendations.push('能見度低，請打開車燈');
    }

    return recommendations;
  }

  /**
   * 獲取天氣等級
   */
  static getWeatherRating(weatherData: WeatherData): 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous' {
    let score = 100;

    // 風速
    if (weatherData.windSpeed > 40) score -= 30;
    else if (weatherData.windSpeed > 25) score -= 15;

    // 降水
    if (weatherData.precipitation > 10) score -= 30;
    else if (weatherData.precipitation > 5) score -= 15;

    // 溫度
    if (weatherData.temperature < -5 || weatherData.temperature > 40) score -= 20;
    else if (weatherData.temperature < 0 || weatherData.temperature > 35) score -= 10;

    // 能見度
    if (weatherData.visibility < 1000) score -= 20;
    else if (weatherData.visibility < 2000) score -= 10;

    // 紫外線
    if (weatherData.uvIndex > 8) score -= 10;

    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'dangerous';
  }
}
