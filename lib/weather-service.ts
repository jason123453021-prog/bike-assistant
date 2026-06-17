/**
 * 天氣服務 — 使用 Open-Meteo 免費 API（無需 API Key）
 * https://open-meteo.com/
 */

export interface WeatherData {
  temperature: number;      // °C
  windSpeed: number;        // km/h
  windDirection: number;    // degrees
  precipitationProb: number; // %
  weatherCode: number;
  description: string;
}

const WMO_CODES: Record<number, string> = {
  0: "晴天", 1: "大致晴天", 2: "部分多雲", 3: "陰天",
  45: "霧", 48: "霜霧",
  51: "毛毛雨", 53: "毛毛雨", 55: "濃毛毛雨",
  61: "小雨", 63: "中雨", 65: "大雨",
  71: "小雪", 73: "中雪", 75: "大雪",
  80: "陣雨", 81: "中陣雨", 82: "強陣雨",
  95: "雷雨", 96: "雷雨夾冰雹", 99: "強雷雨",
};

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code&wind_speed_unit=kmh&timezone=auto`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = await response.json();
    const c = data.current;
    return {
      temperature: Math.round(c.temperature_2m),
      windSpeed: Math.round(c.wind_speed_10m),
      windDirection: c.wind_direction_10m,
      precipitationProb: c.precipitation_probability ?? 0,
      weatherCode: c.weather_code,
      description: WMO_CODES[c.weather_code] ?? "未知",
    };
  } catch {
    return null;
  }
}

/**
 * 將風向角度轉換為風速分量（逆風為正，用於功率計算）
 * headingDeg: 騎行方向（0=北, 90=東...）
 * windDirDeg: 風的來向（0=北風, 90=東風...）
 * windSpeedKmh: 風速 km/h
 */
export function getHeadwindMs(
  headingDeg: number,
  windDirDeg: number,
  windSpeedKmh: number
): number {
  const diff = ((windDirDeg - headingDeg + 360) % 360) * (Math.PI / 180);
  const headwindKmh = windSpeedKmh * Math.cos(diff);
  return headwindKmh / 3.6; // 轉換為 m/s
}
