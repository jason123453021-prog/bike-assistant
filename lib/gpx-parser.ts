/**
 * GPX 檔案解析器
 * 解析 GPX XML 格式，提取路線點、距離、爬升等資訊
 *
 * 卡路里計算採用科學物理公式：
 *   E_total = E_gravity + E_rolling + E_aero
 *   E_gravity  = m × g × Δh  （克服重力位能，僅計算爬升段）
 *   E_rolling  = Crr × m × g × d  （滾動阻力）
 *   E_aero     = 0.5 × ρ × CdA × v² × d  （空氣阻力，使用平均速度）
 *   E_mech → E_metabolic：除以 0.25（人體肌肉代謝效率 25%）
 *   最後換算為 kcal（÷ 4184 J/kcal）
 */

import { haversineDistance } from "./power-calc";
import { reportRecoverableIssue } from "./release-safe-log";

// ─── 物理常數 ─────────────────────────────────────────────────────────────────
const G = 9.81;           // 重力加速度 m/s²
const RHO = 1.225;        // 空氣密度 kg/m³（海平面 15°C）
const CDA = 0.35;         // 騎行姿勢阻力面積 m²（公路車彎腰姿勢）
const CRR = 0.004;        // 滾動阻力係數（公路胎）
const EFFICIENCY = 0.25;  // 人體肌肉代謝效率 25%
const J_PER_KCAL = 4184;  // 焦耳/千卡

/**
 * 路線規劃檔多半不帶氣壓計海拔，直接逐點累加會把 GPS／DEM 的上下抖動誤當成爬坡。
 * 僅使用原始 GPX 的座標與 `<ele>` 值：先移除不合理的孤立尖峰，再以 50m 水平重採樣、25m 垂直門檻累加。
 * 此設定適用於密集規劃 GPX，避免數萬個原始內插海拔點將細微起伏重複累加成不合理總爬升。
 */
export const ROUTE_ELEVATION_MIN_SAMPLE_DISTANCE_M = 50;
export const ROUTE_ELEVATION_CHANGE_THRESHOLD_M = 25;
const ROUTE_ELEVATION_SPIKE_GRADE_LIMIT = 60;

// 天氣對空氣密度的修正（溫度影響）
// ρ = 1.225 × (288.15 / (273.15 + T))
function airDensity(tempC: number): number {
  return 1.225 * (288.15 / (273.15 + tempC));
}

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number;
  time?: string;
}

/**
 * 坡度分布 bucket：
 *   0  = 平路 (< 1%)
 *   1  = 1%–5%
 *   2  = 6%–10%
 *   3  = 11%–15%
 *   4  = 16%–20%
 *   5  = 21%–25%
 *   6  = 26% 以上
 * value 為佔路線距離百分比（0-100）
 */
export type GradientDistribution = Record<number, number>;

export interface GpxRoute {
  name: string;
  points: GpxPoint[];
  totalDistance: number;    // meters
  totalAscent: number;      // meters（總爬升）
  totalDescent: number;     // meters（總下降）
  estimatedDuration: number; // seconds
  /** 使用預設體重 70kg + 單車 10kg 計算的基礎卡路里，供顯示用 */
  estimatedCalories: number;
  elevationProfile: { distance: number; elevation: number }[];
  /** 坡度分布：各坡度區間佔路線距離的百分比（0-100） */
  gradientDistribution: GradientDistribution;
  /** 平均坡度（僅計算爬升段）% */
  avgGradient: number;
  /** 最大坡度 % */
  maxGradient: number;
}

export interface RouteElevationStatistics {
  elevations: number[];
  totalAscent: number;
  totalDescent: number;
}

function isIsolatedElevationSpike(points: readonly GpxPoint[], index: number): boolean {
  if (index <= 0 || index >= points.length - 1) return false;
  const previous = points[index - 1];
  const current = points[index];
  const next = points[index + 1];
  const leftChange = current.ele - previous.ele;
  const rightChange = next.ele - current.ele;
  const reversesImmediately = Math.sign(leftChange) !== Math.sign(rightChange);
  if (!reversesImmediately || Math.min(Math.abs(leftChange), Math.abs(rightChange)) < ROUTE_ELEVATION_CHANGE_THRESHOLD_M) return false;

  const leftDistance = haversineDistance(previous.lat, previous.lon, current.lat, current.lon);
  const rightDistance = haversineDistance(current.lat, current.lon, next.lat, next.lon);
  const leftGrade = leftDistance > 0 ? Math.abs((leftChange / leftDistance) * 100) : Infinity;
  const rightGrade = rightDistance > 0 ? Math.abs((rightChange / rightDistance) * 100) : Infinity;
  return leftGrade >= ROUTE_ELEVATION_SPIKE_GRADE_LIMIT && rightGrade >= ROUTE_ELEVATION_SPIKE_GRADE_LIMIT;
}

/**
 * 取得供路線預覽、時間、功率與補給估算共用的海拔統計。
 * 海拔小幅來回變化在跨越門檻前不會計入，以免長距離 GPX 的內插起伏與雜訊放大總爬升。
 */
export function calculateRouteElevationStatistics(points: readonly GpxPoint[]): RouteElevationStatistics {
  if (!points.length) return { elevations: [], totalAscent: 0, totalDescent: 0 };

  const elevations = points.map((point, index) => {
    if (!isIsolatedElevationSpike(points, index)) return point.ele;
    const previous = points[index - 1];
    const next = points[index + 1];
    return (previous.ele + next.ele) / 2;
  });

  const samples: number[] = [elevations[0] ?? 0];
  let lastSampleIndex = 0;
  for (let index = 1; index < points.length; index++) {
    const isLastPoint = index === points.length - 1;
    const horizontalDistance = haversineDistance(
      points[lastSampleIndex].lat,
      points[lastSampleIndex].lon,
      points[index].lat,
      points[index].lon,
    );
    if (!isLastPoint && horizontalDistance < ROUTE_ELEVATION_MIN_SAMPLE_DISTANCE_M) continue;
    lastSampleIndex = index;
    samples.push(elevations[index] ?? samples.at(-1) ?? 0);
  }

  let totalAscent = 0;
  let totalDescent = 0;
  let acceptedElevation = samples[0] ?? 0;
  for (const elevation of samples.slice(1)) {
    const change = elevation - acceptedElevation;
    if (change >= ROUTE_ELEVATION_CHANGE_THRESHOLD_M) {
      totalAscent += change;
      acceptedElevation = elevation;
    } else if (change <= -ROUTE_ELEVATION_CHANGE_THRESHOLD_M) {
      totalDescent += Math.abs(change);
      acceptedElevation = elevation;
    }
  }

  return { elevations, totalAscent, totalDescent };
}

/**
 * 科學物理公式計算路線卡路里消耗
 *
 * @param route      解析後的 GPX 路線
 * @param totalMassKg 騎手體重 + 單車裝備總重 (kg)
 * @param avgSpeedKmh 預估平均速度 (km/h)，用於計算空氣阻力
 * @param tempC       環境溫度 (°C)，影響空氣密度
 * @returns 預估卡路里 (kcal)
 */
export function estimateRouteCalories(
  route: GpxRoute,
  totalMassKg: number,
  avgSpeedKmh: number = 20,
  tempC: number = 25
): {
  totalKcal: number;
  climbKcal: number;
  flatKcal: number;
  breakdown: {
    gravityKcal: number;
    rollingKcal: number;
    aeroKcal: number;
  };
} {
  const avgSpeedMs = avgSpeedKmh / 3.6;
  const rho = airDensity(tempC);
  const distM = route.totalDistance;

  // ── 1. 重力位能（爬坡消耗）────────────────────────────────────────────────
  // E = m × g × Δh（只計算正爬升，下坡視為制動耗散）
  const gravityJ = totalMassKg * G * route.totalAscent;

  // ── 2. 滾動阻力（全程）────────────────────────────────────────────────────
  // E = Crr × m × g × d
  const rollingJ = CRR * totalMassKg * G * distM;

  // ── 3. 空氣阻力（全程，使用平均速度）────────────────────────────────────
  // E = 0.5 × ρ × CdA × v² × d
  const aeroJ = 0.5 * rho * CDA * Math.pow(avgSpeedMs, 2) * distM;

  // ── 4. 總機械能 → 代謝能（÷ 效率）→ kcal ───────────────────────────────
  const totalMechJ = gravityJ + rollingJ + aeroJ;
  const totalMetabolicJ = totalMechJ / EFFICIENCY;
  const totalKcal = Math.round(totalMetabolicJ / J_PER_KCAL);

  // ── 分項卡路里 ────────────────────────────────────────────────────────────
  const gravityKcal = Math.round((gravityJ / EFFICIENCY) / J_PER_KCAL);
  const rollingKcal = Math.round((rollingJ / EFFICIENCY) / J_PER_KCAL);
  const aeroKcal = Math.round((aeroJ / EFFICIENCY) / J_PER_KCAL);

  // ── 爬坡 vs 平路分項（供 UI 顯示）────────────────────────────────────────
  const climbKcal = gravityKcal;
  const flatKcal = rollingKcal + aeroKcal;

  return {
    totalKcal,
    climbKcal,
    flatKcal,
    breakdown: { gravityKcal, rollingKcal, aeroKcal },
  };
}

/**
 * 解析 GPX XML 字串
 */
export function parseGpx(xmlString: string): GpxRoute | null {
  try {
    const trkptRegex = /<(?:trkpt|rtept|wpt)\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|rtept|wpt)>/g;
    const eleRegex = /<ele>([^<]+)<\/ele>/;
    const timeRegex = /<time>([^<]+)<\/time>/;
    const nameRegex = /<name>([^<]+)<\/name>/;

    const nameMatch = xmlString.match(nameRegex);
    const routeName = nameMatch ? nameMatch[1].trim() : "未命名路線";

    const points: GpxPoint[] = [];
    let match;

    while ((match = trkptRegex.exec(xmlString)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const content = match[3];
      const eleMatch = content.match(eleRegex);
      const timeMatch = content.match(timeRegex);
      points.push({
        lat,
        lon,
        ele: eleMatch ? parseFloat(eleMatch[1]) : 0,
        time: timeMatch ? timeMatch[1] : undefined,
      });
    }

    if (points.length < 2) return null;

    // ── 計算統計 ──────────────────────────────────────────────────────────────
    let totalDistance = 0;
    const elevationStats = calculateRouteElevationStatistics(points);
    const totalAscent = elevationStats.totalAscent;
    const totalDescent = elevationStats.totalDescent;
    const elevationProfile: { distance: number; elevation: number }[] = [];
    // 坡度分布：以 1% 為一個 bucket，0=平路(<0.5%)，1=1%，2=2%...，10+=10%以上
    const gradBuckets: Record<number, number> = {};
    let maxGradient = 0;
    let totalClimbDist = 0;
    let weightedGradSum = 0;

    elevationProfile.push({ distance: 0, elevation: elevationStats.elevations[0] ?? points[0].ele });

    for (let i = 1; i < points.length; i++) {
      const d = haversineDistance(
        points[i - 1].lat, points[i - 1].lon,
        points[i].lat, points[i].lon
      );
      totalDistance += d;

      const altDiff = (elevationStats.elevations[i] ?? points[i].ele) - (elevationStats.elevations[i - 1] ?? points[i - 1].ele);

      elevationProfile.push({ distance: totalDistance, elevation: elevationStats.elevations[i] ?? points[i].ele });

      // ── 坡度計算（僅針對有距離的段落）────────────────────────────────────
      if (d > 0.5) { // 忽略 < 0.5m 的極短段落（GPS 誤差）
        const gradPct = Math.abs((altDiff / d) * 100);
        if (gradPct > maxGradient) maxGradient = gradPct;
        // 爬升段加入加權平均計算
        if (altDiff > 0) {
          totalClimbDist += d;
          weightedGradSum += gradPct * d;
        }
        // 分配到六個坡度區間 bucket
        // 0=平路(<1%), 1=1-5%, 2=6-10%, 3=11-15%, 4=16-20%, 5=21-25%, 6=26%+
        let bucket: number;
        if (gradPct < 1) bucket = 0;
        else if (gradPct <= 5) bucket = 1;
        else if (gradPct <= 10) bucket = 2;
        else if (gradPct <= 15) bucket = 3;
        else if (gradPct <= 20) bucket = 4;
        else if (gradPct <= 25) bucket = 5;
        else bucket = 6;
        gradBuckets[bucket] = (gradBuckets[bucket] ?? 0) + d;
      }
    }

    // ── 預估時間（平地 20 km/h，每 100m 爬升 +10 分鐘）──────────────────────
    const flatTime = (totalDistance / 1000) / 20 * 3600;
    const climbTime = (totalAscent / 100) * 600;
    const estimatedDuration = Math.round(flatTime + climbTime);

    // ── 坡度分布百分比（轉換為佔路線距離的 %）────────────────────────────────
    const gradientDistribution: GradientDistribution = {};
    if (totalDistance > 0) {
      for (const [bucket, dist] of Object.entries(gradBuckets)) {
        gradientDistribution[Number(bucket)] = Math.round((dist / totalDistance) * 100);
      }
    }
    const avgGradient = totalClimbDist > 0
      ? Math.round((weightedGradSum / totalClimbDist) * 10) / 10
      : 0;
    const maxGradientRounded = Math.round(maxGradient * 10) / 10;

    // ── 預估卡路里（預設 70kg 騎手 + 10kg 單車 = 80kg 總重）────────────────
    const baseRoute: GpxRoute = {
      name: routeName,
      points,
      totalDistance,
      totalAscent,
      totalDescent,
      estimatedDuration,
      estimatedCalories: 0,
      elevationProfile,
      gradientDistribution,
      avgGradient,
      maxGradient: maxGradientRounded,
    };
    const { totalKcal } = estimateRouteCalories(baseRoute, 80, 20, 25);

    return {
      ...baseRoute,
      estimatedCalories: totalKcal,
    };
  } catch (e) {
    reportRecoverableIssue("[GPX] Parse error", e);
    return null;
  }
}
