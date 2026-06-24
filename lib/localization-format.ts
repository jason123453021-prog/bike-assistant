/**
 * 日期與數字本地化格式化工具
 * 支援繁體中文、簡體中文、英文
 */

import { LanguageCode } from './i18n';

/**
 * 格式化時間（HH:MM:SS）
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * 格式化持續時間為可讀文本
 * @param seconds 秒數
 * @param language 語言代碼
 */
export function formatDuration(seconds: number, language: LanguageCode = 'zh-TW'): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const formats: Record<LanguageCode, { hour: string; minute: string; second: string }> = {
    'zh-TW': { hour: '小時', minute: '分', second: '秒' },
    'zh-CN': { hour: '小时', minute: '分', second: '秒' },
    'en': { hour: 'h', minute: 'm', second: 's' },
  };
  
  const fmt = formats[language];
  const parts: string[] = [];
  
  if (hours > 0) parts.push(`${hours}${fmt.hour}`);
  if (minutes > 0) parts.push(`${minutes}${fmt.minute}`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}${fmt.second}`);
  
  return parts.join(' ');
}

/**
 * 格式化數字（添加千位分隔符）
 * @param num 數字
 * @param language 語言代碼
 * @param decimals 小數位數
 */
export function formatNumber(
  num: number,
  language: LanguageCode = 'zh-TW',
  decimals: number = 0
): string {
  const separators: Record<LanguageCode, { thousands: string; decimal: string }> = {
    'zh-TW': { thousands: ',', decimal: '.' },
    'zh-CN': { thousands: ',', decimal: '.' },
    'en': { thousands: ',', decimal: '.' },
  };
  
  const sep = separators[language];
  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  
  // 添加千位分隔符
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep.thousands);
  
  if (decimals > 0 && decPart) {
    return `${formattedInt}${sep.decimal}${decPart}`;
  }
  return formattedInt;
}

/**
 * 格式化距離（km）
 * @param km 公里數
 * @param language 語言代碼
 */
export function formatDistance(km: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'km',
    'zh-CN': 'km',
    'en': 'km',
  };
  
  return `${formatNumber(km, language, 2)} ${units[language]}`;
}

/**
 * 格式化速度（km/h）
 * @param kmh 公里/小時
 * @param language 語言代碼
 */
export function formatSpeed(kmh: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'km/h',
    'zh-CN': 'km/h',
    'en': 'km/h',
  };
  
  return `${formatNumber(kmh, language, 1)} ${units[language]}`;
}

/**
 * 格式化功率（W）
 * @param watts 瓦特
 * @param language 語言代碼
 */
export function formatPower(watts: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'W',
    'zh-CN': 'W',
    'en': 'W',
  };
  
  return `${formatNumber(watts, language, 0)} ${units[language]}`;
}

/**
 * 格式化卡路里（kcal）
 * @param kcal 千卡
 * @param language 語言代碼
 */
export function formatCalories(kcal: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'kcal',
    'zh-CN': 'kcal',
    'en': 'kcal',
  };
  
  return `${formatNumber(kcal, language, 0)} ${units[language]}`;
}

/**
 * 格式化水分（ml）
 * @param ml 毫升
 * @param language 語言代碼
 */
export function formatWater(ml: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'ml',
    'zh-CN': 'ml',
    'en': 'ml',
  };
  
  return `${formatNumber(ml, language, 0)} ${units[language]}`;
}

/**
 * 格式化海拔（m）
 * @param meters 公尺
 * @param language 語言代碼
 */
export function formatElevation(meters: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'm',
    'zh-CN': 'm',
    'en': 'm',
  };
  
  return `${formatNumber(meters, language, 0)} ${units[language]}`;
}

/**
 * 格式化心率（bpm）
 * @param bpm 每分鐘心跳數
 * @param language 語言代碼
 */
export function formatHeartRate(bpm: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'bpm',
    'zh-CN': 'bpm',
    'en': 'bpm',
  };
  
  return `${formatNumber(bpm, language, 0)} ${units[language]}`;
}

/**
 * 格式化踏頻（rpm）
 * @param rpm 每分鐘轉數
 * @param language 語言代碼
 */
export function formatCadence(rpm: number, language: LanguageCode = 'zh-TW'): string {
  const units: Record<LanguageCode, string> = {
    'zh-TW': 'rpm',
    'zh-CN': 'rpm',
    'en': 'rpm',
  };
  
  return `${formatNumber(rpm, language, 0)} ${units[language]}`;
}

/**
 * 格式化坡度（%）
 * @param percent 百分比
 * @param language 語言代碼
 */
export function formatGrade(percent: number, language: LanguageCode = 'zh-TW'): string {
  return `${formatNumber(percent, language, 1)}%`;
}

/**
 * 格式化日期
 * @param date 日期物件或時間戳
 * @param language 語言代碼
 * @param format 格式 ('short' | 'long' | 'time')
 */
export function formatDate(
  date: Date | number,
  language: LanguageCode = 'zh-TW',
  format: 'short' | 'long' | 'time' = 'short'
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  
  const options: Record<'short' | 'long' | 'time', Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
  };
  
  const localeMap: Record<LanguageCode, string> = {
    'zh-TW': 'zh-TW',
    'zh-CN': 'zh-CN',
    'en': 'en-US',
  };
  
  return new Intl.DateTimeFormat(localeMap[language], options[format]).format(d);
}

/**
 * 格式化完整日期時間
 * @param date 日期物件或時間戳
 * @param language 語言代碼
 */
export function formatDateTime(
  date: Date | number,
  language: LanguageCode = 'zh-TW'
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  
  const localeMap: Record<LanguageCode, string> = {
    'zh-TW': 'zh-TW',
    'zh-CN': 'zh-CN',
    'en': 'en-US',
  };
  
  return new Intl.DateTimeFormat(localeMap[language], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
