import { Feature, Point } from 'geojson';

export interface RiderProfile {
  weight: number; // 公斤
  bikeWeight: number; // 公斤
  height: number; // 公分
  age: number; // 年齡
  ftp: number; // 功能閾值功率 (瓦)
}

export interface EnvironmentalConditions {
  temperature: number; // 攝氏度
  humidity: number; // 百分比
  windSpeed: number; // m/s
  windDirection: number; // 度 (0-360)
  elevation: number; // 海拔 (米)
}

export class PowerCalculator {
  /**
   * 計算騎乘功率
   * @param speed 速度 (km/h)
   * @param grade 坡度 (%)
   * @param rider 騎手資料
   * @param conditions 環境條件
   * @param heading 騎行方向 (度)
   * @returns 功率 (瓦)
   */
  static calculatePower(
    speed: number,
    grade: number,
    rider: RiderProfile,
    conditions: EnvironmentalConditions,
    heading: number = 0
  ): number {
    const speedMs = speed / 3.6; // 轉換為 m/s

    // 1. 滾動阻力 (Crr)
    const crr = 0.005; // 典型自行車滾動阻力係數
    const rollingResistance = crr * (rider.weight + rider.bikeWeight) * 9.81 * Math.cos(Math.atan(grade / 100));

    // 2. 重力阻力 (爬升)
    const gravityResistance = (rider.weight + rider.bikeWeight) * 9.81 * Math.sin(Math.atan(grade / 100));

    // 3. 空氣阻力
    const cda = 0.4; // 風阻係數 × 前面積 (m²) - 典型騎乘姿勢
    const airDensity = this.calculateAirDensity(conditions.temperature, conditions.elevation);
    
    // 計算有效風速 (考慮騎行方向和風向)
    const effectiveWindSpeed = this.calculateEffectiveWindSpeed(
      speedMs,
      conditions.windSpeed,
      conditions.windDirection,
      heading
    );
    
    const airResistance = 0.5 * cda * airDensity * Math.pow(effectiveWindSpeed, 2);

    // 4. 加速阻力 (假設加速度為 0，穩定騎乘)
    const accelerationResistance = 0;

    // 5. 總功率 (瓦)
    const totalResistance = rollingResistance + gravityResistance + airResistance + accelerationResistance;
    const power = totalResistance * speedMs;

    // 確保功率不為負（下坡時）
    return Math.max(0, power);
  }

  /**
   * 計算空氣密度
   * @param temperature 溫度 (攝氏度)
   * @param elevation 海拔 (米)
   * @returns 空氣密度 (kg/m³)
   */
  private static calculateAirDensity(temperature: number, elevation: number): number {
    // 標準大氣壓 (Pa)
    const p0 = 101325;
    
    // 氣壓隨海拔變化 (簡化模型)
    const pressure = p0 * Math.pow(1 - 0.0065 * elevation / 288.15, 5.255);
    
    // 理想氣體法則: ρ = P / (R * T)
    const R = 287; // 乾空氣特定氣體常數
    const tempK = temperature + 273.15; // 轉換為開爾文
    
    return pressure / (R * tempK);
  }

  /**
   * 計算有效風速
   * @param speed 騎行速度 (m/s)
   * @param windSpeed 風速 (m/s)
   * @param windDirection 風向 (度, 0-360)
   * @param heading 騎行方向 (度, 0-360)
   * @returns 有效風速 (m/s)
   */
  private static calculateEffectiveWindSpeed(
    speed: number,
    windSpeed: number,
    windDirection: number,
    heading: number
  ): number {
    // 轉換為弧度
    const windDirRad = (windDirection * Math.PI) / 180;
    const headingRad = (heading * Math.PI) / 180;

    // 風向相對於騎行方向的角度
    const relativeAngle = windDirRad - headingRad;

    // 風速分量
    const windX = windSpeed * Math.cos(relativeAngle);
    const windY = windSpeed * Math.sin(relativeAngle);

    // 騎行速度向量
    const speedX = speed;
    const speedY = 0;

    // 相對風速
    const relativeWindX = speedX + windX;
    const relativeWindY = speedY + windY;

    // 有效風速大小
    return Math.sqrt(relativeWindX * relativeWindX + relativeWindY * relativeWindY);
  }

  /**
   * 計算心率區間
   * @param heartRate 當前心率 (bpm)
   * @param age 年齡
   * @returns 區間 (1-5)
   */
  static getHeartRateZone(heartRate: number, age: number): number {
    const maxHR = 220 - age;
    const percentage = heartRate / maxHR;

    if (percentage < 0.5) return 1; // 恢復
    if (percentage < 0.6) return 2; // 耐力
    if (percentage < 0.7) return 3; // 節奏
    if (percentage < 0.85) return 4; // 乳酸閾值
    return 5; // 無氧
  }

  /**
   * 計算水分流失
   * @param heartRate 平均心率 (bpm)
   * @param duration 運動時間 (分鐘)
   * @param weight 體重 (kg)
   * @param temperature 溫度 (攝氏度)
   * @param humidity 濕度 (%)
   * @param elevation 海拔 (米)
   * @returns 水分流失 (ml)
   */
  static calculateFluidLoss(
    heartRate: number,
    duration: number,
    weight: number,
    temperature: number,
    humidity: number,
    elevation: number
  ): number {
    // 基礎出汗率 (ml/min) - 基於心率
    const baseSweatRate = (heartRate / 100) * 0.5; // 簡化模型

    // 溫度因子 (溫度越高，出汗越多)
    const tempFactor = 1 + (temperature - 20) * 0.05;

    // 濕度因子 (濕度越高，蒸發越慢，出汗越多)
    const humidityFactor = 1 + (humidity - 50) * 0.01;

    // 海拔因子 (海拔越高，出汗越多)
    const elevationFactor = 1 + elevation / 1000 * 0.1;

    // 總出汗率
    const sweatRate = baseSweatRate * tempFactor * humidityFactor * elevationFactor;

    // 總水分流失
    return sweatRate * duration;
  }

  /**
   * 計算卡路里消耗
   * @param power 平均功率 (瓦)
   * @param duration 運動時間 (分鐘)
   * @param weight 體重 (kg)
   * @returns 卡路里 (kcal)
   */
  static calculateCalories(power: number, duration: number, weight: number): number {
    // 自行車卡路里消耗公式
    // kcal/min = (power in watts * 0.01433) + (weight * 0.0068)
    const caloriesPerMinute = (power * 0.01433) + (weight * 0.0068);
    return caloriesPerMinute * duration;
  }

  /**
   * 計算歸一化功率 (NP)
   * @param powerReadings 功率讀數數組 (瓦)
   * @returns 歸一化功率 (瓦)
   */
  static calculateNormalizedPower(powerReadings: number[]): number {
    if (powerReadings.length === 0) return 0;

    // 30 秒滑動平均
    const smoothedPower: number[] = [];
    for (let i = 0; i < powerReadings.length; i++) {
      const start = Math.max(0, i - 14);
      const end = Math.min(powerReadings.length, i + 15);
      const avg = powerReadings.slice(start, end).reduce((a, b) => a + b, 0) / (end - start);
      smoothedPower.push(avg);
    }

    // 第 4 次方平均
    const fourthPowerSum = smoothedPower.reduce((sum, p) => sum + Math.pow(p, 4), 0);
    const np = Math.pow(fourthPowerSum / smoothedPower.length, 0.25);

    return np;
  }

  /**
   * 計算訓練應力評分 (TSS)
   * @param normalizedPower 歸一化功率 (瓦)
   * @param duration 運動時間 (秒)
   * @param ftp 功能閾值功率 (瓦)
   * @returns TSS 評分
   */
  static calculateTSS(normalizedPower: number, duration: number, ftp: number): number {
    const intensity = normalizedPower / ftp;
    const hours = duration / 3600;
    return (hours * intensity * intensity * 100);
  }
}
