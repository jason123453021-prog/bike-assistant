/**
 * 天氣服務 — 使用 Open-Meteo 免費 API（無需 API Key）
 * https://open-meteo.com/
 */

export interface WeatherData {
  temperature: number;       // °C
  humidity: number;          // % 相對濕度
  windSpeed: number;         // km/h
  windDirection: number;     // degrees
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

// 記憶體快取：同一座標在 5 分鐘內不重新請求
const _cache = new Map<string, { data: WeatherData; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

async function _doFetch(url: string): Promise<WeatherData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000); // 5 秒 timeout
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();
    const c = data.current;
    return {
      temperature: Math.round(c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m ?? 60),
      windSpeed: Math.round(c.wind_speed_10m),
      windDirection: c.wind_direction_10m,
      precipitationProb: c.precipitation_probability ?? 0,
      weatherCode: c.weather_code,
      description: WMO_CODES[c.weather_code] ?? "未知",
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  // 座標四捨五入到小數點後一位作為快取 key
  const key = `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto&forecast_days=1`;

  // 第一次嘗試
  let result = await _doFetch(url);
  // 失敗則等待 1 秒後重試一次
  if (!result) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await _doFetch(url);
  }

  if (result) {
    _cache.set(key, { data: result, ts: Date.now() });
  }
  return result;
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

export interface RelativeWindInfo {
  /** 相對風向文字 */
  label: string;
  /** 風势強度：弱/中/強 */
  intensity: "弱" | "中" | "強";
  /** 風向圖示（SF Symbols 名稱） */
  icon: string;
  /** 風向對騎乘的影響（正數=逆風阻力，負數=順風助力） */
  headwindKmh: number;
}

/**
 * 依騎行方向與風向計算相對風向分類與強度
 * @param headingDeg 騎行方向（0=北, 90=東...）
 * @param windDirDeg 風的來向（0=北風, 90=東風...）
 * @param windSpeedKmh 風速 km/h
 */
export function getRelativeWindInfo(
  headingDeg: number,
  windDirDeg: number,
  windSpeedKmh: number
): RelativeWindInfo {
  // 風向與騎行方向的夹角（順時针）
  const angleDiff = (windDirDeg - headingDeg + 360) % 360;
  // 逆風分量（正=逆風，負=順風）
  const headwindKmh = windSpeedKmh * Math.cos((angleDiff * Math.PI) / 180);

  // 強度分級（依風速絕對値）
  let intensity: RelativeWindInfo["intensity"];
  if (windSpeedKmh < 10) intensity = "弱";
  else if (windSpeedKmh < 25) intensity = "中";
  else intensity = "強";

  // 相對風向分類（依夹角判斷）
  // 0° = 順風（風從騎行方向吹來）
  // 180° = 逆風（風從騎行方向對面吹來）
  let label: string;
  let icon: string;

  if (angleDiff <= 30 || angleDiff >= 330) {
    // 順風（風從後方吹來）
    label = `順風 ${windSpeedKmh.toFixed(0)} km/h`;
    icon = "arrow.down";
  } else if (angleDiff >= 150 && angleDiff <= 210) {
    // 逆風（風從正前方吹來）
    label = `逆風 ${windSpeedKmh.toFixed(0)} km/h`;
    icon = "arrow.up";
  } else if (angleDiff > 30 && angleDiff < 150) {
    // 左側風（騎行方向的左側）
    label = `左側風 ${windSpeedKmh.toFixed(0)} km/h`;
    icon = "arrow.left";
  } else {
    // 右側風
    label = `右側風 ${windSpeedKmh.toFixed(0)} km/h`;
    icon = "arrow.right";
  }

  return { label, intensity, icon, headwindKmh };
}
