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
}

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
export function generateShareCard(ride: RideRecord): ShareCard {
  const date = new Date(ride.date);
  const dateStr = date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    title: `${ride.name || "騎乘紀錄"} - ${dateStr}`,
    distance: Math.round((ride.distance / 1000) * 100) / 100,
    duration: ride.duration,
    elevation: ride.totalAscent,
    avgSpeed: Math.round(ride.avgSpeed * 10) / 10,
    maxSpeed: Math.round(ride.maxSpeed * 10) / 10,
    calories: Math.round(ride.calories),
    date: dateStr,
    routeName: ride.name || "未命名路線",
    emoji: getActivityEmoji(ride.avgSpeed, ride.totalAscent, ride.distance / 1000),
  };
}

/**
 * 生成文字分享內容
 */
export function generateShareText(card: ShareCard): string {
  const durationStr = formatDuration(card.duration);
  
  return `${card.emoji} ${card.title}\n\n` +
    `📏 距離: ${card.distance} km\n` +
    `⏱️ 時間: ${durationStr}\n` +
    `📈 爬升: ${card.elevation} m\n` +
    `⚡ 平均速度: ${card.avgSpeed} km/h\n` +
    `🏁 最高速度: ${card.maxSpeed} km/h\n` +
    `🔥 卡路里: ${card.calories} kcal\n\n` +
    `#騎乘紀錄 #單車 #自行車 #運動`;
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
