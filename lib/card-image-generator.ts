/**
 * 分享卡片圖片生成器
 * 使用 react-native-view-shot 將 HTML 卡片轉換為圖片
 */

import { Share } from "react-native";

// 注意：expo-media-library 需要另外安裝
let MediaLibrary: any = null;

try {
  MediaLibrary = require("expo-media-library");
} catch (e) {
  console.warn("expo-media-library not available");
}

// 注意：react-native-view-shot 需要另外安裝
// 在實際使用中，可以使用 expo-screen-capture 或其他替代方案
let captureRef: any = null;

try {
  const viewShot = require("react-native-view-shot");
  captureRef = viewShot.captureRef;
} catch (e) {
  console.warn("react-native-view-shot not available, using fallback");
}

export interface CardImageOptions {
  format?: "png" | "jpg";
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * 從 View 生成卡片圖片
 */
export async function captureCardImage(
  viewRef: any,
  options: CardImageOptions = {}
): Promise<string> {
  const { format = "png", quality = 0.9, width = 1080, height = 1920 } = options;

  try {
    if (!captureRef) {
      throw new Error("react-native-view-shot not available");
    }

    const uri = await captureRef(viewRef, {
      format,
      quality,
      width,
      height,
      result: "file",
    });

    return uri;
  } catch (error) {
    console.error("Failed to capture card image:", error);
    throw error;
  }
}

/**
 * 保存卡片圖片到相機膠捲
 */
export async function saveCardToGallery(imageUri: string): Promise<boolean> {
  try {
    // 請求相機膠捲權限
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      console.error("Camera roll permission denied");
      return false;
    }

    // 保存到相機膠捲
    const asset = await MediaLibrary.createAssetAsync(imageUri);
    await MediaLibrary.createAlbumAsync("騎乘助手", asset, false);

    return true;
  } catch (error) {
    console.error("Failed to save card to gallery:", error);
    throw error;
  }
}

/**
 * 分享卡片圖片
 */
export async function shareCardImage(
  imageUri: string,
  title: string = "我的騎乘成績"
): Promise<void> {
  try {
    await Share.share({
      url: imageUri,
      title,
      message: `${title} - 來自騎乘助手`,
    });
  } catch (error) {
    console.error("Failed to share card image:", error);
    throw error;
  }
}

/**
 * 生成卡片圖片並保存
 */
export async function generateAndSaveCard(
  viewRef: any,
  options: CardImageOptions = {}
): Promise<{ imageUri: string; saved: boolean }> {
  try {
    // 生成圖片
    const imageUri = await captureCardImage(viewRef, options);

    // 保存到相機膠捲
    const saved = await saveCardToGallery(imageUri);

    return { imageUri, saved };
  } catch (error) {
    console.error("Failed to generate and save card:", error);
    throw error;
  }
}

/**
 * 生成卡片圖片並分享
 */
export async function generateAndShareCard(
  viewRef: any,
  title: string = "我的騎乘成績",
  options: CardImageOptions = {}
): Promise<void> {
  try {
    // 生成圖片
    const imageUri = await captureCardImage(viewRef, options);

    // 分享圖片
    await shareCardImage(imageUri, title);
  } catch (error) {
    console.error("Failed to generate and share card:", error);
    throw error;
  }
}

/**
 * HTML 卡片轉圖片（用於 Web 預覽）
 */
export function generateCardHTML(data: {
  title: string;
  distance: number;
  time: number;
  speed: number;
  elevation: number;
  calories: number;
  date: string;
  location?: string;
}): string {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 100%;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          margin-bottom: 5px;
          font-weight: 700;
        }
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          padding: 0;
        }
        .stat {
          padding: 20px;
          border-right: 1px solid #f0f0f0;
          border-bottom: 1px solid #f0f0f0;
          text-align: center;
        }
        .stat:nth-child(2n) {
          border-right: none;
        }
        .stat:nth-last-child(-n+2) {
          border-bottom: none;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 5px;
        }
        .stat-label {
          font-size: 12px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .footer {
          padding: 20px;
          text-align: center;
          background: #f9f9f9;
          border-top: 1px solid #f0f0f0;
        }
        .footer p {
          font-size: 12px;
          color: #999;
        }
        .logo {
          font-size: 14px;
          font-weight: 600;
          color: #667eea;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🚴 ${data.title}</h1>
          <p>${data.date}</p>
        </div>
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${(data.distance / 1000).toFixed(2)}</div>
            <div class="stat-label">距離 (km)</div>
          </div>
          <div class="stat">
            <div class="stat-value">${formatTime(data.time)}</div>
            <div class="stat-label">時間</div>
          </div>
          <div class="stat">
            <div class="stat-value">${data.speed.toFixed(1)}</div>
            <div class="stat-label">平均速度 (km/h)</div>
          </div>
          <div class="stat">
            <div class="stat-value">${data.elevation.toFixed(0)}</div>
            <div class="stat-label">爬升 (m)</div>
          </div>
          <div class="stat">
            <div class="stat-value">${data.calories.toFixed(0)}</div>
            <div class="stat-label">卡路里 (kcal)</div>
          </div>
          <div class="stat">
            <div class="stat-value">${(data.distance / data.time * 3.6).toFixed(1)}</div>
            <div class="stat-label">最大速度 (km/h)</div>
          </div>
        </div>
        <div class="footer">
          <p>分享自 <span class="logo">騎乘助手</span></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
