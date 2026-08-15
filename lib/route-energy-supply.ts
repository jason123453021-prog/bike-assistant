/**
 * GPX 路線的攜帶能量補給規劃。
 * 以一份約 25 g 碳水的常見能量膠／能量棒為換算單位；結果只供保守的騎乘規劃參考。
 */
export interface RouteEnergySupplyCarryPlan {
  minimumServings: number;
  maximumServings: number;
  standardServingCarbohydrateG: number;
  minimumCarbohydrateG: number;
  maximumCarbohydrateG: number;
  factors: string[];
}

const STANDARD_SERVING_CARBOHYDRATE_G = 25;

export function estimateRouteEnergySupplyCarry(input: {
  estimatedDurationSeconds: number;
  upperDurationSeconds: number;
  intensityFactor: number;
  totalAscentM: number;
  distanceM: number;
  temperatureC?: number;
  humidityPct?: number;
  averageHeadwindMs?: number;
  precipitationProb?: number;
}): RouteEnergySupplyCarryPlan {
  const durationHours = Math.max(0, input.estimatedDurationSeconds / 3600);
  const upperDurationHours = Math.max(durationHours, input.upperDurationSeconds / 3600);
  const ascentPerKm = input.distanceM > 0 ? input.totalAscentM / (input.distanceM / 1000) : 0;

  // 一小時內通常不需強制攜帶途中能量；更長路線採 30–60 g/h 基準並依負荷上調。
  if (durationHours <= 1) {
    return {
      minimumServings: 0,
      maximumServings: 0,
      standardServingCarbohydrateG: STANDARD_SERVING_CARBOHYDRATE_G,
      minimumCarbohydrateG: 0,
      maximumCarbohydrateG: 0,
      factors: ["預估移動時間不超過 1 小時，途中不強制攜帶能量補給"],
    };
  }

  const highIntensity = input.intensityFactor >= 0.85;
  const demandingClimb = ascentPerKm >= 15 || input.totalAscentM >= 800;
  const heatLoad = (input.temperatureC ?? 25) >= 28 && (input.humidityPct ?? 60) >= 60;
  const headwindLoad = (input.averageHeadwindMs ?? 0) >= 3;
  const rainLoad = (input.precipitationProb ?? 0) >= 50;

  let minimumRateGPerHour = highIntensity ? 40 : 30;
  if (demandingClimb) minimumRateGPerHour += 5;
  if (heatLoad || headwindLoad) minimumRateGPerHour += 5;
  minimumRateGPerHour = Math.min(60, minimumRateGPerHour);

  let maximumRateGPerHour = minimumRateGPerHour + 20;
  if (durationHours >= 2.5) maximumRateGPerHour += 10;
  if (durationHours >= 4 && highIntensity) maximumRateGPerHour += 10;
  maximumRateGPerHour = Math.min(90, maximumRateGPerHour);

  // 最低份數不計第一小時內的途中攝取；最高份數使用最慢到達時間，並納入一份備援。
  const minimumCarbohydrateG = Math.ceil(minimumRateGPerHour * Math.max(0, durationHours - 1));
  const maximumCarbohydrateG = Math.ceil(
    maximumRateGPerHour * Math.max(0, upperDurationHours - 0.75) + STANDARD_SERVING_CARBOHYDRATE_G,
  );
  const minimumServings = Math.ceil(minimumCarbohydrateG / STANDARD_SERVING_CARBOHYDRATE_G);
  const maximumServings = Math.max(minimumServings, Math.ceil(maximumCarbohydrateG / STANDARD_SERVING_CARBOHYDRATE_G));

  const factors = ["預估完成時間與 App 自動 FTP 強度"];
  if (demandingClimb) factors.push("爬升與坡度負荷");
  if (heatLoad) factors.push("高溫高濕熱負荷");
  if (headwindLoad) factors.push("相對逆風");
  if (rainLoad) factors.push("降雨延誤備援");

  return {
    minimumServings,
    maximumServings,
    standardServingCarbohydrateG: STANDARD_SERVING_CARBOHYDRATE_G,
    minimumCarbohydrateG,
    maximumCarbohydrateG,
    factors,
  };
}
