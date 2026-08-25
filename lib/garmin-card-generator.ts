/**
 * Garmin 風格圖卡生成與分享
 * 生成騎乘成績卡片供社群分享
 */

import { RideRecord } from "./ride-context";

export interface ShareCard {
  title: string;
  distance: number;        // km
  duration: number;        // 秒
  elevation: number;       // m
  avgSpeed: number;        // km/h
  maxSpeed: number;        // km/h
  calories: number;
  date: string;
  routeName: string;
  emoji: string;
  // 核心數據
  movingTime?: number;     // 移動時間（秒）
  totalDescent?: number;   // 總下降高度（m）
  maxElevation?: number;   // 最大海拔（m）
  // 進階訓練數據
  avgHeartRate?: number;   // 平均心率（bpm）
  maxHeartRate?: number;   // 最大心率（bpm）
  avgCadence?: number;     // 平均踏頻（rpm）
  maxCadence?: number;     // 最大踏頻（rpm）
  avgPower?: number;       // 平均功率（W）
  maxPower?: number;       // 最大功率（W）
  normalizedPower?: number;// 標準化功率（W）
  intensityFactor?: number;// 強度係數（IF）
  tss?: number;            // 訓練壓力分數（TSS）
}

export type ShareTranslator = (key: string, options?: Record<string, unknown>) => string;

const defaultShareTranslator: ShareTranslator = (key) => ({
  "share.untitledRide": "未命名騎乘", "share.distance": "距離", "share.movingTime": "移動時間", "share.elevation": "總爬升", "share.averageSpeed": "平均速度", "share.maxSpeed": "最高速度", "share.calories": "卡路里", "share.hashtags": "#騎乘紀錄 #單車 #自行車 #運動",
}[key] ?? key);

/**
 * 格式化時間為 HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * 根據騎乘強度選擇 emoji
 */
export function getActivityEmoji(avgSpeed: number, elevation: number, distance: number): string {
  const difficulty = (avgSpeed * 0.5) + (elevation / distance * 10);

  if (difficulty > 30) return "🔥"; // 高強度
  if (difficulty > 20) return "💪"; // 中高強度
  if (difficulty > 10) return "🚴"; // 中等強度
  return "🌿";                       // 輕鬆騎乘
}

/**
 * 生成分享卡片資料
 */
export function generateShareCard(ride: RideRecord, options?: { locale?: string; t?: ShareTranslator }): ShareCard {
  const locale = options?.locale ?? "zh-TW";
  const t = options?.t ?? defaultShareTranslator;
  const date = new Date(ride.date);
  const dateStr = date.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    title: `${ride.name || t("share.untitledRide")} - ${dateStr}`,
    distance: Math.round((ride.distance / 1000) * 100) / 100,
    duration: ride.duration,
    elevation: ride.totalAscent,
    avgSpeed: Math.round(ride.avgSpeed * 10) / 10,
    maxSpeed: Math.round(ride.maxSpeed * 10) / 10,
    calories: Math.round(ride.calories),
    date: dateStr,
    routeName: ride.name || t("share.untitledRide"),
    emoji: getActivityEmoji(ride.avgSpeed, ride.totalAscent, ride.distance / 1000),
    movingTime: ride.movingTime,
    totalDescent: ride.totalDescent,
    maxElevation: ride.maxElevation,
    avgHeartRate: ride.avgHeartRate,
    maxHeartRate: ride.maxHeartRate,
    avgCadence: ride.avgCadence,
    maxCadence: ride.maxCadence,
    avgPower: ride.avgPower,
    maxPower: ride.maxPower,
    normalizedPower: ride.normalizedPower,
    intensityFactor: ride.intensityFactor,
    tss: ride.tss,
  };
}

/**
 * 生成文字分享內容
 */
export function generateShareText(card: ShareCard, t: ShareTranslator = defaultShareTranslator): string {
  const durationStr = formatDuration(card.duration);
  
  return `${card.emoji} ${card.title}\n\n` +
    `📏 ${t("share.distance")}: ${card.distance} km\n` +
    `⏱️ ${t("share.movingTime")}: ${durationStr}\n` +
    `📈 ${t("share.elevation")}: ${card.elevation} m\n` +
    `⚡ ${t("share.averageSpeed")}: ${card.avgSpeed} km/h\n` +
    `🏁 ${t("share.maxSpeed")}: ${card.maxSpeed} km/h\n` +
    `🔥 ${t("share.calories")}: ${card.calories} kcal\n\n` +
    t("share.hashtags");
}

/**
 * 生成 HTML 分享卡片（用於截圖或分享）
 */
export function generateShareCardHTML(card: ShareCard): string {
  const durationStr = formatDuration(card.duration);
  const pace = card.distance > 0 ? (card.duration / 60) / card.distance : 0;
  const paceStr = `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .card {
          width: 600px;
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .emoji {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #333;
          margin: 10px 0;
        }
        .date {
          font-size: 14px;
          color: #999;
        }
        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 30px 0;
        }
        .stat {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        }
        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
          margin: 10px 0;
        }
        .stat-label {
          font-size: 12px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 12px;
          color: #999;
        }
        .hashtags {
          margin-top: 20px;
          font-size: 12px;
          color: #667eea;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="emoji">${card.emoji}</div>
          <div class="title">${card.routeName}</div>
          <div class="date">${card.date}</div>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-label">距離</div>
            <div class="stat-value">${card.distance}</div>
            <div class="stat-label">km</div>
          </div>
          <div class="stat">
            <div class="stat-label">時間</div>
            <div class="stat-value">${durationStr}</div>
            <div class="stat-label">h:m:s</div>
          </div>
          <div class="stat">
            <div class="stat-label">平均速度</div>
            <div class="stat-value">${card.avgSpeed}</div>
            <div class="stat-label">km/h</div>
          </div>
          <div class="stat">
            <div class="stat-label">爬升</div>
            <div class="stat-value">${card.elevation}</div>
            <div class="stat-label">m</div>
          </div>
          <div class="stat">
            <div class="stat-label">最高速度</div>
            <div class="stat-value">${card.maxSpeed}</div>
            <div class="stat-label">km/h</div>
          </div>
          <div class="stat">
            <div class="stat-label">配速</div>
            <div class="stat-value">${paceStr}</div>
            <div class="stat-label">min/km</div>
          </div>
        </div>
        
        <div class="footer">
          <div>🔥 卡路里消耗: ${card.calories} kcal</div>
          <div class="hashtags">#騎乘紀錄 #單車 #自行車 #運動</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * 計算騎乘等級
 */
export function calculateRideLevel(distance: number, elevation: number, avgSpeed: number): string {
  const score = (distance * 0.5) + (elevation * 0.3) + (avgSpeed * 0.2);

  if (score > 100) return "🏆 傳奇";
  if (score > 80) return "⭐ 精英";
  if (score > 60) return "💪 高手";
  if (score > 40) return "🚴 進階";
  if (score > 20) return "🌿 初級";
  return "👶 新手";
}
